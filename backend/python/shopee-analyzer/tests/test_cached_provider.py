"""
CachedProvider 本地 JSON 缓存装饰器单元测试
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_cached_provider.py -v
"""
import json
import os


class _CountingProvider:
    """记录被真实调用了几次的假 provider"""
    name = "counting"
    ready = True

    def __init__(self, result_map=None):
        self.result_map = result_map or {}
        self.calls = []

    def fetch_sku(self, item_id):
        self.calls.append(item_id)
        return self.result_map.get(item_id, {
            "sku_count": 1, "min_price": "5.00", "max_price": "5.00",
            "min_price_spec": "红", "skus": [{"spec": "红", "price": "5.00"}], "error": None,
        })


def test_cache_miss_calls_inner_and_persists(tmp_path):
    """未命中 → 调内层、写盘"""
    from sku_provider import CachedProvider
    path = str(tmp_path / "c.json")
    inner = _CountingProvider()
    p = CachedProvider(inner, path)
    r = p.fetch_sku("A1")
    assert r["min_price"] == "5.00"
    assert inner.calls == ["A1"]
    assert os.path.exists(path)
    assert "A1" in json.load(open(path, encoding="utf-8"))


def test_cache_hit_skips_inner(tmp_path):
    """命中 → 不再调内层"""
    from sku_provider import CachedProvider
    p = CachedProvider(_CountingProvider(), str(tmp_path / "c.json"))
    p.fetch_sku("A1")
    p.fetch_sku("A1")
    p.fetch_sku("A1")
    assert p._inner.calls == ["A1"]  # 只调了一次


def test_cache_persists_across_instances(tmp_path):
    """重建 CachedProvider（如下次请求）→ 读到上次落盘的缓存，不再调内层"""
    from sku_provider import CachedProvider
    path = str(tmp_path / "c.json")
    CachedProvider(_CountingProvider(), path).fetch_sku("A1")
    inner2 = _CountingProvider()
    r = CachedProvider(inner2, path).fetch_sku("A1")
    assert r["min_price"] == "5.00"
    assert inner2.calls == []  # 命中盘上缓存，零调用


def test_failed_result_not_cached(tmp_path):
    """内层返回 error（如 item-not-found）→ 不缓存，下次仍重试"""
    from sku_provider import CachedProvider
    inner = _CountingProvider(result_map={
        "BAD": {"sku_count": 0, "min_price": None, "max_price": None,
                "min_price_spec": None, "skus": [], "error": "item-not-found"},
    })
    p = CachedProvider(inner, str(tmp_path / "c.json"))
    p.fetch_sku("BAD")
    p.fetch_sku("BAD")
    assert inner.calls == ["BAD", "BAD"]  # 失败不入缓存，两次都真调


def test_corrupt_cache_file_starts_empty(tmp_path):
    """缓存文件损坏 → 当空缓存处理，不崩"""
    from sku_provider import CachedProvider
    path = str(tmp_path / "c.json")
    with open(path, "w", encoding="utf-8") as f:
        f.write("{ not valid json")
    p = CachedProvider(_CountingProvider(), path)
    r = p.fetch_sku("A1")  # 不抛异常
    assert r["error"] is None
    assert p._inner.calls == ["A1"]


def test_name_and_ready_delegate_to_inner(tmp_path):
    """name/ready 透传内层，对下游状态展示无感"""
    from sku_provider import CachedProvider
    p = CachedProvider(_CountingProvider(), str(tmp_path / "c.json"))
    assert p.name == "counting"
    assert p.ready is True


# ── get_provider 工厂：cache.enabled 时套缓存 ──

def test_get_provider_wraps_with_cache_when_enabled(tmp_path):
    """cache.enabled 且 provider 就绪 → 返回 CachedProvider，name 仍为内层名"""
    from sku_provider import get_provider, CachedProvider
    cfg = {"sku_provider": {
        "active": "onebound",
        "onebound": {"key": "k", "secret": "s"},
        "cache": {"enabled": True, "path": str(tmp_path / "c.json")},
    }}
    p = get_provider(cfg)
    assert isinstance(p, CachedProvider)
    assert p.name == "onebound"
    assert p.ready is True


def test_get_provider_no_cache_when_disabled():
    """cache 未开 → 不套缓存，直接返回内层 provider"""
    from sku_provider import get_provider, OneboundProvider
    cfg = {"sku_provider": {"active": "onebound", "onebound": {"key": "k", "secret": "s"}}}
    assert isinstance(get_provider(cfg), OneboundProvider)


def test_get_provider_no_cache_for_unready_provider(tmp_path):
    """provider 未就绪（无凭证）→ 即便开了缓存也不套（缓存空 provider 无意义）"""
    from sku_provider import get_provider, OneboundProvider
    cfg = {"sku_provider": {
        "active": "onebound",
        "onebound": {},  # 无 key/secret → not ready
        "cache": {"enabled": True, "path": str(tmp_path / "c.json")},
    }}
    assert isinstance(get_provider(cfg), OneboundProvider)
