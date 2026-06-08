"""
SKU 获取（_fetch_skus_into）+ 建行（_build_rows）单元测试
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_build_rows_provider.py -v
"""
import pytest


COST_CFG = {"cny_per_brl": 1.35, "cost_multiplier": 1.3, "target_margin_rate": 0.15, "high_margin_rate": 0.30}


class _FakeProvider:
    """可控的假 provider：指定哪些 offer 成功、哪些抛异常"""
    name = "fake"
    ready = True

    def __init__(self, ok_map=None, raise_ids=None, ready=True):
        self.ok_map = ok_map or {}
        self.raise_ids = set(raise_ids or [])
        self.calls = []
        self.ready = ready

    def fetch_sku(self, item_id):
        self.calls.append(item_id)
        if item_id in self.raise_ids:
            raise RuntimeError(f"boom {item_id}")
        if item_id in self.ok_map:
            return self.ok_map[item_id]
        return {"sku_count": 0, "min_price": None, "max_price": None, "min_price_spec": None, "skus": [], "error": "not found"}


def _prod(pid, price="R$ 19.90"):
    return {"product_id": pid, "product_name": f"商品{pid}", "image_url": "http://x/1.jpg", "shopee_price_brl": price}


def _cand(item_id):
    return {"itemId": item_id, "title": f"候选{item_id}", "itemPrice": "7.40", "link": "", "sales": "", "offerTags": ["高度同款"], "purchaseInfos": [{"value": "2件起批"}], "providerInfo": {"companyName": "厂A"}}


def _drain(gen):
    """跑完生成器，返回 yield 出的所有进度帧"""
    return list(gen)


# ── _build_rows：纯建行，吃预填好的 sku_cache，不拉取/不 sleep ──

def test_build_rows_injects_sku_from_cache():
    """_build_rows 把 sku_cache 里的数据写进候选的 sku 字段"""
    from sourcing import _build_rows
    sku_cache = {"A1": {"sku_count": 3, "min_price": "5.00", "max_price": "9.00", "min_price_spec": "红", "skus": [{"spec": "红", "price": "5.00"}], "error": None}}
    rows = _build_rows([_prod("P1")], {"P1": [_cand("A1")]}, COST_CFG, sku_cache)
    sku = rows[0]["candidates"][0]["sku"]
    assert sku["count"] == 3
    assert sku["min_price"] == "5.00"


def test_build_rows_empty_cache_no_crash():
    """sku_cache 为空（未配置/未获取）→ 不报错，SKU 列为空"""
    from sourcing import _build_rows
    rows = _build_rows([_prod("P1")], {"P1": [_cand("A1")]}, COST_CFG)
    assert len(rows) == 1
    assert rows[0]["candidates"][0]["sku"]["count"] == 0


# ── _fetch_skus_into：串行拉取 + 逐 offer 进度 + 填 cache ──

def test_fetch_skus_yields_progress_per_offer():
    """每拉完一个 offer yield 一条进度 (current/total/item_id)，cache 被填好"""
    from sourcing import _fetch_skus_into
    provider = _FakeProvider(ok_map={
        f"A{i}": {"sku_count": 1, "min_price": "5.00", "max_price": "5.00", "min_price_spec": "红", "skus": [], "error": None}
        for i in range(3)
    })
    candidates_map = {f"P{i}": [_cand(f"A{i}")] for i in range(3)}
    sku_cache = {}
    progs = _drain(_fetch_skus_into(provider, candidates_map, sku_cache))

    assert [p["current"] for p in progs] == [1, 2, 3]
    assert all(p["total"] == 3 for p in progs)
    assert set(sku_cache.keys()) == {"A0", "A1", "A2"}
    assert sku_cache["A0"]["sku_count"] == 1


def test_fetch_skus_serial_with_interval(monkeypatch):
    """相邻 offer 之间按 _SKU_REQUEST_INTERVAL_SEC 间隔（给万邦喘息，避免 503）"""
    import sourcing
    from sourcing import _fetch_skus_into
    sleeps = []
    monkeypatch.setattr(sourcing.time, "sleep", lambda s: sleeps.append(s))
    provider = _FakeProvider(ok_map={
        f"A{i}": {"sku_count": 1, "min_price": "5.00", "max_price": "5.00", "min_price_spec": "红", "skus": [], "error": None}
        for i in range(3)
    })
    candidates_map = {f"P{i}": [_cand(f"A{i}")] for i in range(3)}
    _drain(_fetch_skus_into(provider, candidates_map, {}))

    interval = sourcing._SKU_REQUEST_INTERVAL_SEC
    assert interval >= 1.0, "万邦默认 1-3 秒一次，间隔不应小于 1 秒"
    paced = [s for s in sleeps if s >= interval]
    assert len(paced) >= 2, f"间隔次数不足: {sleeps}"  # 3 个请求至少间隔 2 次


def test_fetch_skus_isolates_failure():
    """某 offer 抛异常 → cache 记空+error，不阻塞后续 offer"""
    from sourcing import _fetch_skus_into
    provider = _FakeProvider(
        ok_map={"GOOD": {"sku_count": 2, "min_price": "8.00", "max_price": "12.00", "min_price_spec": "L", "skus": [], "error": None}},
        raise_ids={"BAD"},
    )
    candidates_map = {"P1": [_cand("BAD")], "P2": [_cand("GOOD")]}
    sku_cache = {}
    progs = _drain(_fetch_skus_into(provider, candidates_map, sku_cache))

    assert len(progs) == 2  # 两个 offer 都跑到了
    assert sku_cache["BAD"]["sku_count"] == 0
    assert sku_cache["BAD"]["error"]
    assert sku_cache["GOOD"]["sku_count"] == 2


def test_fetch_skus_skips_when_not_ready():
    """provider 未就绪 → 不拉取、不 yield、cache 不变"""
    from sourcing import _fetch_skus_into
    provider = _FakeProvider(ready=False)
    sku_cache = {}
    progs = _drain(_fetch_skus_into(provider, {"P1": [_cand("A1")]}, sku_cache))
    assert progs == []
    assert sku_cache == {}
    assert provider.calls == []
