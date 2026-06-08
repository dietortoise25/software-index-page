"""
_build_rows 经 SKU Provider 富化的单元测试
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_build_rows_provider.py -v
"""
import pytest


COST_CFG = {"cny_per_brl": 1.35, "cost_multiplier": 1.3, "target_margin_rate": 0.15, "high_margin_rate": 0.30}


class _FakeProvider:
    """可控的假 provider：指定哪些 offer 成功、哪些抛异常"""
    name = "fake"
    ready = True

    def __init__(self, ok_map=None, raise_ids=None):
        self.ok_map = ok_map or {}
        self.raise_ids = set(raise_ids or [])
        self.calls = []

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


def test_build_rows_injects_sku_from_provider():
    """_build_rows 用注入的 provider 取 SKU，写进候选的 sku 字段"""
    from sourcing import _build_rows
    provider = _FakeProvider(ok_map={
        "A1": {"sku_count": 3, "min_price": "5.00", "max_price": "9.00", "min_price_spec": "红", "skus": [{"spec": "红", "price": "5.00"}], "error": None},
    })
    products = [_prod("P1")]
    candidates_map = {"P1": [_cand("A1")]}

    rows = _build_rows(products, candidates_map, COST_CFG, provider=provider)

    assert provider.calls == ["A1"]
    sku = rows[0]["candidates"][0]["sku"]
    assert sku["count"] == 3
    assert sku["min_price"] == "5.00"


def test_build_rows_isolates_provider_failure():
    """某 offer 取 SKU 抛异常，不阻塞其他 offer，整批照常返回"""
    from sourcing import _build_rows
    provider = _FakeProvider(
        ok_map={"GOOD": {"sku_count": 2, "min_price": "8.00", "max_price": "12.00", "min_price_spec": "L", "skus": [{"spec": "L", "price": "8.00"}], "error": None}},
        raise_ids={"BAD"},
    )
    products = [_prod("P1"), _prod("P2")]
    candidates_map = {"P1": [_cand("BAD")], "P2": [_cand("GOOD")]}

    rows = _build_rows(products, candidates_map, COST_CFG, provider=provider)

    assert len(rows) == 2
    by_pid = {r["product_id"]: r for r in rows}
    # 失败 offer：sku 为空，但行仍存在
    assert by_pid["P1"]["candidates"][0]["sku"]["count"] == 0
    # 成功 offer：sku 正常注入
    assert by_pid["P2"]["candidates"][0]["sku"]["count"] == 2


def test_build_rows_default_provider_no_crash():
    """不传 provider 时（默认 NullProvider），不报错，SKU 列为空"""
    from sourcing import _build_rows
    products = [_prod("P1")]
    candidates_map = {"P1": [_cand("A1")]}

    rows = _build_rows(products, candidates_map, COST_CFG)

    assert len(rows) == 1
    assert rows[0]["candidates"][0]["sku"]["count"] == 0


# ── 串行单发：万邦试用档 1-3 秒一次，整批并发会被打 503，必须串行+间隔 ──

class _OverlapProvider:
    """记录请求是否重叠的假 provider（用于验证串行执行）"""
    name = "overlap"
    ready = True

    def __init__(self):
        import threading
        self._lock = threading.Lock()
        self.inflight = 0
        self.max_inflight = 0
        self.calls = []

    def fetch_sku(self, item_id):
        import time
        with self._lock:
            self.inflight += 1
            self.max_inflight = max(self.max_inflight, self.inflight)
            self.calls.append(item_id)
        time.sleep(0.01)  # 制造重叠窗口；若并发则 max_inflight>1
        with self._lock:
            self.inflight -= 1
        return {"sku_count": 1, "min_price": "5.00", "max_price": "5.00", "min_price_spec": "红", "skus": [], "error": None}


def test_build_rows_fetches_sku_serially():
    """多个 offer 的 SKU 获取串行执行，绝不并发（峰值并发恒为 1）"""
    from sourcing import _build_rows
    provider = _OverlapProvider()
    products = [_prod(f"P{i}") for i in range(5)]
    candidates_map = {f"P{i}": [_cand(f"A{i}")] for i in range(5)}

    _build_rows(products, candidates_map, COST_CFG, provider=provider)

    assert provider.max_inflight == 1, f"SKU 请求未串行，峰值并发={provider.max_inflight}"
    assert len(provider.calls) == 5


def test_build_rows_spaces_sku_requests(monkeypatch):
    """相邻 SKU 请求之间按 _SKU_REQUEST_INTERVAL_SEC 间隔，给万邦喘息"""
    import sourcing
    from sourcing import _build_rows
    sleeps = []
    monkeypatch.setattr(sourcing.time, "sleep", lambda s: sleeps.append(s))
    provider = _FakeProvider(ok_map={
        f"A{i}": {"sku_count": 1, "min_price": "5.00", "max_price": "5.00", "min_price_spec": "红", "skus": [], "error": None}
        for i in range(3)
    })
    products = [_prod(f"P{i}") for i in range(3)]
    candidates_map = {f"P{i}": [_cand(f"A{i}")] for i in range(3)}

    _build_rows(products, candidates_map, COST_CFG, provider=provider)

    interval = sourcing._SKU_REQUEST_INTERVAL_SEC
    assert interval >= 1.0, "万邦默认 1-3 秒一次，间隔不应小于 1 秒"
    # 3 个请求至少间隔 2 次
    paced = [s for s in sleeps if s >= interval]
    assert len(paced) >= 2, f"间隔次数不足: {sleeps}"
