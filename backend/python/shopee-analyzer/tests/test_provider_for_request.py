"""
运行时按请求选择 SKU Provider 的单元测试
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_provider_for_request.py -v
"""

CFG = {
    "sku_provider": {
        "active": "",  # 服务器默认：无
        "onebound": {"key": "k", "secret": "s"},
        "justoneapi": {"token": "t"},
    }
}


def test_empty_request_uses_server_default():
    """前端没传 → 用服务器配置的默认（这里默认为空 → NullProvider）"""
    from sourcing import _provider_for_request
    from sku_provider import NullProvider
    p = _provider_for_request(CFG, "")
    assert isinstance(p, NullProvider)


def test_request_onebound_overrides():
    """前端传 onebound → 覆盖为 OneboundProvider，凭证仍取自服务器配置"""
    from sourcing import _provider_for_request
    from sku_provider import OneboundProvider
    p = _provider_for_request(CFG, "onebound")
    assert isinstance(p, OneboundProvider)
    assert p.ready is True  # 用上了配置里的 key/secret


def test_request_none_forces_null_even_if_server_default_set():
    """前端显式选'无' → 强制 NullProvider，即便服务器默认配了别的"""
    from sourcing import _provider_for_request
    from sku_provider import NullProvider
    cfg = {**CFG, "sku_provider": {**CFG["sku_provider"], "active": "onebound"}}
    p = _provider_for_request(cfg, "none")
    assert isinstance(p, NullProvider)


def test_request_does_not_mutate_caller_cfg():
    """覆盖时不能改坏调用方传入的 cfg（避免污染全局配置）"""
    from sourcing import _provider_for_request
    snapshot = CFG["sku_provider"]["active"]
    _provider_for_request(CFG, "onebound")
    assert CFG["sku_provider"]["active"] == snapshot


def test_unknown_request_falls_back_to_null():
    """前端传未知名字 → 安全回退 NullProvider，不崩"""
    from sourcing import _provider_for_request
    from sku_provider import NullProvider
    p = _provider_for_request(CFG, "garbage")
    assert isinstance(p, NullProvider)
