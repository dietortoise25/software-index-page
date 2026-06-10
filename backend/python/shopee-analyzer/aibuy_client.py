"""
1688 aibuy 图搜客户端 — 纯标准库，可直接嵌入 FastAPI
用法:
    from aibuy_client import search_by_image

    offers, total = search_by_image("https://example.com/image.webp")
    for o in offers:
        print(o["title"], o["itemPrice"])
"""
import json
import base64
import hashlib
import logging
import threading
import time
import urllib.request
import urllib.parse
import http.cookiejar
from typing import Optional, Tuple, List, Dict, Any, Callable

import httpx

from clients.http import make_client, make_retry, request_json
from models.errors import classify_exception

logger = logging.getLogger("aibuy")

H5API = "https://h5api.m.1688.com"
APP_KEY = "12574478"
_CUSTOMER_ID = "wangxiaowang"
_BIZ_TYPE = "ERP"
_LANGUAGE = "zh"
_CURRENCY = "CNY"
_PLATFORM = "1688"

_jar: Optional[http.cookiejar.CookieJar] = None
_cs: str = ""
_tk: str = ""
_api_config: dict = {}
_lock = threading.Lock()

# 统一 httpx 客户端 + tenacity 重试。测试时可注入 MockTransport 客户端 / 零退避工厂。
_client: Optional[httpx.Client] = None
_retry_factory: Optional[Callable] = None


def _get_client() -> httpx.Client:
    """惰性创建模块级共享客户端;测试可直接赋值 _client 注入 MockTransport。"""
    global _client
    if _client is None:
        _client = make_client(read_timeout=30.0)
    return _client


def _get_retry():
    factory = _retry_factory or make_retry
    return factory()


def configure(api_config: dict):
    """注入 1688 API 配置（从 YAML 读取后调用）"""
    global APP_KEY, _CUSTOMER_ID, _BIZ_TYPE, _LANGUAGE, _CURRENCY, _PLATFORM, _api_config
    _api_config = api_config
    APP_KEY = api_config.get("app_key", APP_KEY)
    _CUSTOMER_ID = api_config.get("customer_id", _CUSTOMER_ID)
    _BIZ_TYPE = api_config.get("biz_type", _BIZ_TYPE)
    _LANGUAGE = api_config.get("language", _LANGUAGE)
    _CURRENCY = api_config.get("currency", _CURRENCY)
    _PLATFORM = api_config.get("platform", _PLATFORM)


def _do_fetch_token() -> Tuple[str, str]:
    """实际发起 HTTP 请求获取游客 token（内部用）"""
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    url = f"{H5API}/h5/mtop.1688.pc.plugin.safe.heartbeat.key.get/1.0/"
    url += f"?jsv=2.7.2&appKey={APP_KEY}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": "https://www.1688.com/",
    })
    try:
        opener.open(req, timeout=10)
    except Exception:
        pass

    cs = "; ".join(f"{c.name}={c.value}" for c in jar)
    tk = ""
    for c in jar:
        if c.name == "_m_h5_tk":
            tk = c.value.split("_")[0]
            break
    return cs, tk


def get_session() -> Tuple[str, str]:
    """
    获取游客 session（线程安全）。
    返回 (cookie_string, mtop_token)。
    Session 有效期 ~5400 秒，内部自动缓存。
    """
    global _jar, _cs, _tk
    if _tk:
        return _cs, _tk

    with _lock:
        if _tk:
            return _cs, _tk
        _cs, _tk = _do_fetch_token()
        logger.info(f"1688 session 已获取, token={_tk[:16]}...")
        return _cs, _tk


def warmup_session():
    """预热 1688 token（服务启动后调用，避免并发竞态）"""
    cs, tk = get_session()
    if tk:
        logger.info(f"1688 session 预热完成, token={tk[:16]}...")
    else:
        logger.warning("1688 session 预热失败，后续请求将自动重试")
    return cs, tk


def reset_session():
    """强制刷新 session（token 过期时调用）"""
    global _jar, _cs, _tk
    _jar = None
    _cs = ""
    _tk = ""


def _mtop_get(api: str, data_obj: dict) -> dict:
    """mtop GET 请求。签名计算保持不变,仅 HTTP 发送改走 request_json(httpx+重试+错误分类)。"""
    cs, tk = get_session()
    d = json.dumps(data_obj, separators=(",", ":"))
    t = int(time.time() * 1000)
    s = hashlib.md5(f"{tk}&{t}&{APP_KEY}&{d}".encode()).hexdigest()
    p = f"jsv=2.7.5&appKey={APP_KEY}&t={t}&sign={s}&type=originaljson&v=1.0&ecode=0&dataType=json"
    u = f"{H5API}/h5/{api}?{p}&data={urllib.parse.quote(d)}"
    return request_json(_get_client(), "GET", u, retry=_get_retry(), headers={
        "Cookie": cs, "User-Agent": "Mozilla/5.0",
        "Referer": "https://aibuy.1688.com/",
    })


def _mtop_post(api: str, data_obj: dict) -> dict:
    """mtop POST 请求。签名计算保持不变,仅 HTTP 发送改走 request_json(httpx+重试+错误分类)。"""
    cs, tk = get_session()
    d = json.dumps(data_obj, separators=(",", ":"))
    t = int(time.time() * 1000)
    s = hashlib.md5(f"{tk}&{t}&{APP_KEY}&{d}".encode()).hexdigest()
    p = f"jsv=2.7.5&appKey={APP_KEY}&t={t}&sign={s}&type=originaljson&v=1.0&ecode=0&dataType=json"
    u = f"{H5API}/h5/{api}?{p}"
    return request_json(_get_client(), "POST", u, retry=_get_retry(),
                        data={"data": d}, headers={
                            "Content-Type": "application/x-www-form-urlencoded",
                            "Cookie": cs, "User-Agent": "Mozilla/5.0",
                            "Referer": "https://aibuy.1688.com/",
                        })


def _detect_mime(data: bytes) -> str:
    """检测图片 MIME 类型"""
    if data[:4] == b"RIFF":
        return "image/webp"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    return "image/jpeg"


def search_by_image(
    image_input: str,
    page_size: int = 10,
    page: int = 1,
    same_style_only: bool = True,
) -> Tuple[List[Dict[str, Any]], int]:
    """
    以图搜图 — 单张图片 → 1688 候选商品列表

    参数:
        image_input: 图片 URL 或本地文件路径
        page_size:  每页候选数 (默认 10)
        page:       页码 (从 1 开始)
        same_style_only: 是否只返回"高度同款" (默认 True)

    返回:
        (offers_list, total_count)

    每个 offer 包含:
        title, itemId, itemPrice, link, sales,
        offerTags, providerInfo, purchaseInfos 等
    """
    # 1. 加载图片
    if image_input.startswith("http://") or image_input.startswith("https://"):
        try:
            resp = _get_client().get(image_input, timeout=15)
            resp.raise_for_status()
            data = resp.content
        except Exception as e:
            raise classify_exception(e)
    else:
        with open(image_input, "rb") as f:
            data = f.read()

    # 2. base64
    mime = _detect_mime(data)
    b64 = f"data:{mime};base64," + base64.b64encode(data).decode()

    # 3. 上传 (token 过期时自动重试一次)
    for attempt in (1, 2):
        r = _mtop_post("mtop.com.alibaba.global.select.aibuy.image.upload/1.0/", {
            "bizType": _BIZ_TYPE,
            "customerId": _CUSTOMER_ID,
            "language": _LANGUAGE,
            "currency": _CURRENCY,
            "imageBase64": b64,
        })
        ret = r.get("ret", [])
        ret_str = str(ret) if ret else ""
        if "FAIL_SYS_TOKEN_EMPTY" in ret_str or "TOKEN" in ret_str:
            if attempt == 1:
                logger.warning("1688 token 失效，刷新后重试...")
                reset_session()
                continue
        break

    iu = r.get("data", {}).get("result", {}).get("imageUrl")
    if not iu:
        raise RuntimeError(f"upload failed: {json.dumps(r, ensure_ascii=False)[:300]}")

    # 4. 搜索
    r = _mtop_get("mtop.com.alibaba.global.select.aibuy.image.search/1.0/", {
        "bizType": _BIZ_TYPE,
        "customerId": _CUSTOMER_ID,
        "language": _LANGUAGE,
        "currency": _CURRENCY,
        "platform": _PLATFORM,
        "beginPage": page,
        "pageSize": page_size,
        "imageUrl": iu,
    })
    offers = r.get("data", {}).get("data", [])
    total = r["data"].get("total", 0)

    # 5. 筛选
    if same_style_only:
        offers = [o for o in offers if "高度同款" in str(o.get("offerTags", []))]

    return offers, total


# ===== 便捷函数 =====

def search_and_export(
    image_input: str,
    top_n: int = 5,
) -> List[dict]:
    """
    搜索并返回精简字段列表，适合直接返回给前端。
    字段: title, price_cny, link, sales, shop_name, min_order, offer_tags
    """
    offers, total = search_by_image(image_input, page_size=top_n)
    return [{
        "title": o.get("title", ""),
        "price_cny": o.get("itemPrice", ""),
        "link": o.get("link", ""),
        "sales": o.get("sales", ""),
        "shop_name": (o.get("providerInfo") or {}).get("companyName", ""),
        "min_order": (o.get("purchaseInfos") or [{}])[0].get("value", ""),
        "offer_tags": o.get("offerTags", []),
    } for o in offers]


# ===== 测试入口 =====
if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        img = sys.argv[1]
    else:
        img = "https://down-ws-cn.img.susercontent.com/file/sg-11134301-825ai-mg54j6h0p9fwc8.webp"
        print(f"使用默认图片: {img[:60]}...\n")

    print("搜索中...")
    offers, total = search_by_image(img, page_size=5)

    print(f"共 {total} 候选, 展示前5个:\n")
    for i, o in enumerate(offers, 1):
        print(f"  #{i} ¥{o['itemPrice']:>6} | {o['title'][:55]}")
        print(f"       {o.get('offerTags',[])} | 销量 {o['sales']}")
    print(f"\n✅ 完成")
