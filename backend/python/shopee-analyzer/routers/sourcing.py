"""
选品比价 FastAPI 路由 —— 从 sourcing.py 抽出的 HTTP 层（MVC 分层）。

职责仅限：入参校验 / 文件读取 / 调 pipeline / 拼 SSE。
纯计算/取数/SSE 辅助函数仍在 sourcing.py，本模块通过 `import sourcing` 引用
并以 `sourcing.xxx` 形式调用，保留既有 patch("sourcing.xxx") 测试入口
（search_by_image / get_provider / make_client 等在 sourcing 命名空间）。

前端调用（经 nginx /api/shopee/sourcing → 后端 /api/sourcing）:
  POST  /api/sourcing/search             批量搜图
  POST  /api/sourcing/analyze            搜图 + 成本计算
  POST  /api/sourcing/analyze-stream     SSE 流式版（含 llm_token/candidate_scored/llm_retry 逐字透传）
  GET   /api/sourcing/config             读取配置
  PUT   /api/sourcing/config             更新配置
  GET   /api/sourcing/system             读取系统配置
  PUT   /api/sourcing/system             更新系统配置
  POST  /api/sourcing/config/reload      强制重载配置
  GET   /api/sourcing/sku-provider/status SKU Provider 健康状态
"""
import asyncio
import logging
import queue
from concurrent.futures import ThreadPoolExecutor
from typing import List

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse

import sourcing
from sourcing import (
    _cfg, _check_files, _read_files, _limit_products, _cost_cfg_from,
    _collect_offer_ids, _fetch_skus_into, _build_rows,
    _sse, _heartbeat_frame, _run_with_heartbeat, _SKU_REQUEST_INTERVAL_SEC,
    _HEARTBEAT_INTERVAL_SEC,
)
from config import (
    load_sourcing_config, save_sourcing_config, reload_sourcing_config, deep_merge,
)
from aibuy_client import configure as configure_aibuy, warmup_session

logger = logging.getLogger("sourcing")

router = APIRouter(prefix="/api/sourcing", tags=["sourcing"])


# ========== 业务端点 ==========

@router.post("/search")
async def sourcing_search(
    files: List[UploadFile] = File(...),
    page_size: int = Form(0),
    same_style_only: bool = Form(True),
):
    """上传多个 Shopee Excel，批量以图搜货，返回候选商品（不做成本计算）"""
    from concurrent.futures import as_completed
    cfg = _cfg()
    sc = cfg["search"]
    if page_size <= 0:
        page_size = sc["page_size"]

    _check_files(files, cfg["limits"]["max_file_size_mb"])
    df, _ = _read_files(files, cfg["columns"])
    products = df.to_dict(orient="records")
    logger.info(f"[search] {len(files)} 个文件, {len(products)} 个产品")

    results = []
    max_workers = sc["max_concurrency"]

    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {ex.submit(sourcing._search_one, p, page_size, same_style_only): p
                   for p in products}
        for fut in as_completed(futures):
            pid, _name, cands, err = fut.result()
            results.append({
                "product_id": pid,
                "candidates": cands,
                "total": len(cands),
                "error": err,
            })

    results.sort(key=lambda r: next(
        i for i, p in enumerate(products) if p["product_id"] == r["product_id"]
    ))

    return {"products": products, "results": results}


@router.post("/analyze")
async def sourcing_analyze(
    files: List[UploadFile] = File(...),
    page_size: int = Form(0),
    same_style_only: bool = Form(True),
    cny_per_brl: float = Form(0),
    cost_multiplier: float = Form(-1),
    target_margin_rate: float = Form(-1),
    high_margin_rate: float = Form(-1),
):
    """上传多个 Shopee Excel → 搜图 + 成本计算 + 推荐"""
    from concurrent.futures import as_completed
    cfg = _cfg()
    sc = cfg["search"]
    if page_size <= 0:
        page_size = sc["page_size"]

    _check_files(files, cfg["limits"]["max_file_size_mb"])
    df, _ = _read_files(files, cfg["columns"])
    products = df.to_dict(orient="records")
    logger.info(f"[analyze] {len(files)} 个文件, {len(products)} 个产品")

    overrides = {}
    if cny_per_brl > 0: overrides["cny_per_brl"] = cny_per_brl
    if cost_multiplier >= 0: overrides["cost_multiplier"] = cost_multiplier
    if target_margin_rate >= 0: overrides["target_margin_rate"] = target_margin_rate
    if high_margin_rate >= 0: overrides["high_margin_rate"] = high_margin_rate
    cost_cfg = _cost_cfg_from(cfg, overrides if overrides else None)

    candidates_map = {}
    max_workers = sc["max_concurrency"]

    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {ex.submit(sourcing._search_one, p, page_size, same_style_only): p
                   for p in products}
        for fut in as_completed(futures):
            pid, _name, cands, _ = fut.result()
            candidates_map[pid] = cands

    # 串行拉 SKU（非流式：无进度，直接跑完）→ 用服务器默认 provider
    provider = sourcing.get_provider(cfg)
    sku_cache: dict = {}
    for _ in _fetch_skus_into(provider, candidates_map, sku_cache):
        pass
    # step5：调 LLM 为每个货品选最佳 SKU（失败/无 SKU 则上游兜底）
    matches: dict = {}
    for _ in sourcing._match_all(products, candidates_map, sku_cache, matches):
        pass
    rows = _build_rows(products, candidates_map, cost_cfg, sku_cache, matches)

    summary = {
        "total_products": len(rows),
        "with_1688_data": sum(1 for r in rows if r["has_1688_data"]),
        "recommended": sum(1 for r in rows if r["recommendation"] == "推荐"),
        "consider": sum(1 for r in rows if r["recommendation"] == "可考虑"),
        "warning": sum(1 for r in rows if r["recommendation"] == "预警"),
        "incomplete": sum(1 for r in rows if r["recommendation"] == "待补全"),
    }

    return {"summary": summary, "rows": rows, "cost_config": cost_cfg}


@router.post("/analyze-stream")
async def sourcing_analyze_stream(
    files: List[UploadFile] = File(...),
    page_size: int = Form(0),
    same_style_only: bool = Form(True),
    cny_per_brl: float = Form(0),
    cost_multiplier: float = Form(-1),
    target_margin_rate: float = Form(-1),
    high_margin_rate: float = Form(-1),
    sku_provider: str = Form(""),
    limit: int = Form(0),
):
    """SSE 流式版 — 实时推送每个产品的搜索进度 + 成本计算结果。
    SKU 匹配阶段把 LLM 逐字 token / 候选评分 / 流中断重试透传成
    llm_token / candidate_scored / llm_retry 帧。"""
    cfg = _cfg()
    sc = cfg["search"]
    if page_size <= 0:
        page_size = sc["page_size"]

    _check_files(files, cfg["limits"]["max_file_size_mb"])
    df, raw_columns = _read_files(files, cfg["columns"])
    products = df.to_dict(orient="records")
    products = _limit_products(products, limit)
    total = len(products)
    max_workers = sc["max_concurrency"]
    logger.info(f"[stream] {len(files)} 个文件, {total} 个产品")

    overrides = {}
    if cny_per_brl > 0: overrides["cny_per_brl"] = cny_per_brl
    if cost_multiplier >= 0: overrides["cost_multiplier"] = cost_multiplier
    if target_margin_rate >= 0: overrides["target_margin_rate"] = target_margin_rate
    if high_margin_rate >= 0: overrides["high_margin_rate"] = high_margin_rate
    cost_cfg = _cost_cfg_from(cfg, overrides if overrides else None)

    async def generate():
        yield _sse("phase", {"phase": "parsing", "message": f"已解析 {total} 个产品"})
        yield _sse("start", {"total": total, "message": f"开始并发搜图 ({max_workers} 线程)"})

        loop = asyncio.get_event_loop()
        executor = ThreadPoolExecutor(max_workers=max_workers)
        candidates_map = {}
        done = 0

        try:
            fut_map = {}
            for p in products:
                fut = loop.run_in_executor(executor, sourcing._search_one, p, page_size, same_style_only)
                fut_map[fut] = p

            for fut in asyncio.as_completed(fut_map):
                pid, name, cands, err = await fut
                done += 1
                candidates_map[pid] = cands
                yield _sse("progress", {
                    "current": done,
                    "total": total,
                    "product_id": pid,
                    "product_name": name,
                    "candidates_count": len(cands),
                    "error": err,
                })
        finally:
            executor.shutdown(wait=False)

        # 后端经 SKU Provider 获取价格表（不再依赖浏览器扩展回传）
        provider = sourcing._provider_for_request(cfg, sku_provider)
        offer_ids = _collect_offer_ids(candidates_map)
        offer_count = len(offer_ids)
        yield _sse("phase", {
            "phase": "fetching_sku",
            "message": f"经 {provider.name} 串行获取 {offer_count} 个候选的 SKU 价格表（约 {_SKU_REQUEST_INTERVAL_SEC}s/个）..."
                       if provider.ready else "未配置 SKU Provider，跳过 SKU 价格表",
            "provider": provider.name,
            "ready": provider.ready,
            "total": offer_count,
        })

        # 串行拉 SKU：每拉完一个 offer 推一条进度（sleep 在线程里跑，不阻塞 event loop）
        sku_cache: dict = {}
        if provider.ready and offer_ids:
            gen = _fetch_skus_into(provider, candidates_map, sku_cache)
            while True:
                prog = await loop.run_in_executor(None, lambda: next(gen, None))
                if prog is None:
                    break
                yield _sse("sku_progress", {
                    **prog,
                    "message": f"SKU 价格表 {prog['current']}/{prog['total']}",
                })

        # 图文核对：对每个货品的全部候选并发打图文分（gpt-5.5 vision）
        from image_verify import verify_candidates as _verify_candidates
        conf_map: dict = {}
        total_cands = sum(len(v) for v in candidates_map.values())
        yield _sse("phase", {
            "phase": "image_verify",
            "message": f"图文核对 {total_cands} 个候选（GPT vision）...",
            "total": len(products),
        })
        for idx, prod in enumerate(products, 1):
            pid = prod["product_id"]
            shopee_img = prod.get("image_url", "")
            raw_cands = candidates_map.get(pid, [])
            cand_structs = [{"item_id": c.get("itemId", ""), "image_url": c.get("imageUrl", ""),
                             "title": c.get("title", "")} for c in raw_cands]
            async for kind, payload in _run_with_heartbeat(
                loop, lambda: _verify_candidates(shopee_img, cand_structs)):
                if kind == "heartbeat":
                    yield _heartbeat_frame()
                else:
                    conf_map[pid] = payload
            yield _sse("verify_progress", {
                "current": idx,
                "total": len(products),
                "message": f"图文核对 {idx}/{len(products)}",
            })

        # step5：调 LLM 为每个货品智能匹配最佳 SKU（每货品一次，失败兜底）。
        # match_sku 的 on_token 是同步回调、在 executor 线程里触发；用线程安全 queue
        # 把 llm_token/candidate_scored/llm_retry 事件桥接到 async 侧 yield 成 SSE 帧。
        matches: dict = {}
        yield _sse("phase", {
            "phase": "matching_sku",
            "message": f"AI 智能匹配最佳 SKU（{len(products)} 个货品）...",
            "ready": True,
            "total": len(products),
        })

        evt_q: "queue.Queue" = queue.Queue()
        _DONE = object()

        on_token = lambda iid, tok: evt_q.put(("llm_token", iid, tok))
        on_retry = lambda iid: evt_q.put(("llm_retry", iid, None))
        on_candidate_scored = lambda iid, score: evt_q.put(("candidate_scored", iid, score))

        def _run_match_all():
            """后台线程：消费整个 _match_all generator。token/retry/candidate_scored
            由回调实时 put；每货品 step 完成后把 match_progress 也 put 进同一队列。
            结束（含异常）推哨兵 _DONE，async 侧据此收尾。"""
            try:
                mgen = sourcing._match_all(products, candidates_map, sku_cache, matches,
                                           conf_map=conf_map, on_token=on_token,
                                           on_retry=on_retry,
                                           on_candidate_scored=on_candidate_scored)
                for prog in mgen:
                    evt_q.put(("match_progress", None, prog))
            except Exception as exc:
                evt_q.put(("error", None, exc))
            finally:
                evt_q.put((_DONE, None, None))

        # 后台线程跑匹配，async 主协程实时抽队列：token 一产生就 yield（真逐字），
        # 拿不到事件则按心跳间隔发心跳，任何慢阶段都不会帧间静默。
        match_fut = loop.run_in_executor(None, _run_match_all)
        match_err = None
        while True:
            try:
                kind, item_id, extra = await loop.run_in_executor(
                    None, lambda: evt_q.get(timeout=_HEARTBEAT_INTERVAL_SEC))
            except queue.Empty:
                yield _heartbeat_frame()
                continue
            if kind is _DONE:
                break
            if kind == "error":
                match_err = extra
                continue
            if kind == "llm_token":
                yield _sse("llm_token", {
                    "item_id": item_id, "phase": "sku_match", "token": extra})
            elif kind == "candidate_scored":
                yield _sse("candidate_scored", {
                    "item_id": item_id, "match_overall_score": extra})
            elif kind == "llm_retry":
                yield _sse("llm_retry", {"item_id": item_id})
            elif kind == "match_progress":
                yield _sse("match_progress", {
                    **extra,
                    "message": f"AI 匹配 SKU {extra['current']}/{extra['total']}",
                })
        await match_fut
        if match_err is not None:
            raise match_err

        rows = None
        async for kind, payload in _run_with_heartbeat(
            loop, lambda: _build_rows(products, candidates_map, cost_cfg, sku_cache, matches, conf_map)):
            if kind == "heartbeat":
                yield _heartbeat_frame()
            else:
                rows = payload

        sku_ok = sum(1 for r in rows for c in r["candidates"] if c.get("sku", {}).get("count", 0) > 0)
        sku_failed = sum(1 for r in rows for c in r["candidates"] if c.get("sku", {}).get("count", 0) == 0)
        yield _sse("phase", {
            "phase": "costing",
            "message": f"SKU 价格表完成（{sku_ok} 成功 / {sku_failed} 无数据），汇总中...",
        })

        summary = {
            "total_products": len(rows),
            "with_1688_data": sum(1 for r in rows if r["has_1688_data"]),
            "recommended": sum(1 for r in rows if r["recommendation"] == "推荐"),
            "consider": sum(1 for r in rows if r["recommendation"] == "可考虑"),
            "warning": sum(1 for r in rows if r["recommendation"] == "预警"),
            "incomplete": sum(1 for r in rows if r["recommendation"] == "待补全"),
        }

        yield _sse("complete", {"summary": summary, "rows": rows,
                                "cost_config": cost_cfg, "raw_columns": raw_columns})

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"})


# ========== 配置 CRUD ==========

@router.get("/config")
async def get_config():
    """读取选品全局配置"""
    return {"config": _cfg()}


@router.put("/config")
async def update_config(body: dict):
    """更新选品全局配置（合并写入 YAML，热生效）"""
    partial = body.get("config", {})
    if not partial:
        raise HTTPException(400, "缺少 config 字段")
    try:
        current = _cfg()
        merged = deep_merge(current.copy(), partial)
        save_sourcing_config(merged)
        configure_aibuy(merged.get("api", {}))
        warmup_session()
        logger.info("[config] 配置已更新")
        return {"status": "ok", "config": merged}
    except Exception:
        logger.exception("[config] 保存失败")
        raise HTTPException(500, {"code": "CONFIG_SAVE_FAILED", "message": "配置保存失败"})


@router.get("/system")
async def get_system_config():
    """读取系统配置（proxy_url 等）"""
    cfg = _cfg()
    return {"system": cfg.get("system", {})}


@router.put("/system")
async def update_system_config(body: dict):
    """更新系统配置"""
    system_cfg = body.get("system", {})
    if not system_cfg:
        raise HTTPException(400, "缺少 system 字段")
    current = _cfg()
    merged = deep_merge(current.copy(), {"system": system_cfg})
    save_sourcing_config(merged)
    logger.info("[config] 系统配置已更新")
    return {"status": "ok", "system": merged.get("system", {})}


@router.post("/config/reload")
async def reload_config():
    """强制从 YAML 重新加载配置（清除缓存）"""
    cfg = reload_sourcing_config()
    configure_aibuy(cfg["api"])
    warmup_session()
    return {"status": "ok", "config": cfg}


# ========== SKU Provider 健康状态 ==========

@router.get("/sku-provider/status")
async def sku_provider_status():
    """当前 SKU Provider 名称 + 是否就绪，供前端指示灯展示"""
    provider = sourcing.get_provider(_cfg())
    return {
        "provider": provider.name,
        "ready": provider.ready,
        "message": (f"SKU Provider「{provider.name}」已就绪" if provider.ready
                    else "未配置 SKU Provider，SKU 价格表将为空"),
    }

