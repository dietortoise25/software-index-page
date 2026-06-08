"""
SKU Provider 抽象层单元测试
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_sku_provider.py -v
"""
import pytest


# ═══════════════════════════════════════════
# 1. get_provider 工厂：按 active 选择
# ═══════════════════════════════════════════

def test_get_provider_empty_active_returns_null():
    """active 为空 → NullProvider"""
    from sku_provider import get_provider, NullProvider
    p = get_provider({"sku_provider": {"active": ""}})
    assert isinstance(p, NullProvider)
    assert p.ready is False


def test_get_provider_missing_section_returns_null():
    """完全没有 sku_provider 配置段 → NullProvider，不报错"""
    from sku_provider import get_provider, NullProvider
    p = get_provider({})
    assert isinstance(p, NullProvider)


def test_get_provider_onebound_selected():
    """active=onebound → OneboundProvider"""
    from sku_provider import get_provider, OneboundProvider
    p = get_provider({"sku_provider": {"active": "onebound", "onebound": {"key": "k", "secret": "s"}}})
    assert isinstance(p, OneboundProvider)
    assert p.name == "onebound"


def test_get_provider_justoneapi_selected():
    """active=justoneapi → JustOneApiProvider"""
    from sku_provider import get_provider, JustOneApiProvider
    p = get_provider({"sku_provider": {"active": "justoneapi", "justoneapi": {"token": "t"}}})
    assert isinstance(p, JustOneApiProvider)
    assert p.name == "justoneapi"


def test_get_provider_unknown_active_returns_null():
    """active 是未知名字 → 回退 NullProvider，不崩"""
    from sku_provider import get_provider, NullProvider
    p = get_provider({"sku_provider": {"active": "nonexistent"}})
    assert isinstance(p, NullProvider)


# ═══════════════════════════════════════════
# 2. NullProvider：未配置语义
# ═══════════════════════════════════════════

def test_null_provider_fetch_returns_empty_with_status():
    """NullProvider.fetch_sku → 空结果 + error 状态，绝不抛异常"""
    from sku_provider import NullProvider
    p = NullProvider()
    result = p.fetch_sku("740919115663")
    assert result["sku_count"] == 0
    assert result["min_price"] is None
    assert result["max_price"] is None
    assert result["skus"] == []
    assert "未配置" in result["error"]


def test_null_provider_name():
    """NullProvider 名称为 none，便于健康端点展示"""
    from sku_provider import NullProvider
    assert NullProvider().name == "none"


# ═══════════════════════════════════════════
# 3. 契约一致性：所有 provider 返回统一字段
# ═══════════════════════════════════════════

def test_provider_result_has_required_keys():
    """任一 provider 的返回必须含统一契约字段"""
    from sku_provider import NullProvider
    result = NullProvider().fetch_sku("123")
    for key in ("sku_count", "min_price", "max_price", "min_price_spec", "skus"):
        assert key in result, f"缺少契约字段 {key}"


# ═══════════════════════════════════════════
# 4. TODO 骨架 provider：就绪状态判断
# ═══════════════════════════════════════════

def test_onebound_ready_requires_credentials():
    """onebound 有 key+secret 才算 ready"""
    from sku_provider import OneboundProvider
    assert OneboundProvider({"key": "k", "secret": "s"}).ready is True
    assert OneboundProvider({}).ready is False


def test_onebound_fetch_request_failure_returns_status(monkeypatch):
    """onebound 请求异常 → 返回带 error 的空结果，不抛异常（不阻塞工作流）"""
    from sku_provider import OneboundProvider
    p = OneboundProvider({"key": "k", "secret": "s"})
    monkeypatch.setattr(p, "_request", lambda iid: (_ for _ in ()).throw(TimeoutError("boom")))
    result = p.fetch_sku("123")
    assert result["sku_count"] == 0
    assert "onebound 请求失败" in result["error"]


def test_onebound_logs_warning_on_api_error(monkeypatch, caplog):
    """万邦返回 HTTP 200 但 body 含 error_code≠0000（如配额超限）→ 必须记 WARNING。
    此前这条路径静默返回空，导致配额耗尽等问题在日志里完全隐形。"""
    import logging
    from sku_provider import OneboundProvider
    p = OneboundProvider({"key": "k", "secret": "s"})
    monkeypatch.setattr(p, "_request", lambda iid: {
        "error_code": "4013", "reason": "Key[t8824513060]已超量,联系QQ:xxx"})
    with caplog.at_level(logging.WARNING, logger="sku_provider"):
        result = p.fetch_sku("971835973029")
    assert result["sku_count"] == 0
    assert "971835973029" in caplog.text  # 日志带上 item_id 便于定位
    assert "已超量" in caplog.text         # 带上万邦的真实原因


def test_onebound_quota_exceeded_gives_clear_hint(monkeypatch):
    """error_code=4013（配额超限）→ error 文案含明确的“配额”提示，便于一眼区分"""
    from sku_provider import OneboundProvider
    p = OneboundProvider({"key": "k", "secret": "s"})
    monkeypatch.setattr(p, "_request", lambda iid: {
        "error_code": "4013", "reason": "Key[t8824513060]已超量"})
    result = p.fetch_sku("971835973029")
    assert "配额" in result["error"]


# ═══════════════════════════════════════════
# 4b. onebound 响应解析（parse_onebound 纯函数，对真实 fixture）
# ═══════════════════════════════════════════

import json
import os

_FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures_onebound_item.json")


def _load_fixture():
    with open(_FIXTURE, encoding="utf-8") as f:
        return json.load(f)


def test_parse_onebound_extracts_skus():
    """真实万邦响应 → 6 个分规格 SKU，含分规格价/库存/skuId"""
    from sku_provider import parse_onebound
    r = parse_onebound(_load_fixture())
    assert r["error"] is None
    assert r["sku_count"] == 6
    s0 = r["skus"][0]
    for key in ("spec", "full_spec", "price", "can_book_count", "sku_id"):
        assert key in s0
    # 规格值从 properties_name 正确提取（如 "浅灰色 / XS"）
    assert "浅灰色" in s0["full_spec"]
    assert s0["sku_id"] == 6081703821914


def test_parse_onebound_price_range():
    """min/max 取自分规格价；本商品各规格同价 75.00"""
    from sku_provider import parse_onebound
    r = parse_onebound(_load_fixture())
    assert r["min_price"] == "75.00"
    assert r["max_price"] == "75.00"
    assert r["min_price_spec"]  # 非空


def test_parse_onebound_item_not_found():
    """error_code 非 0000（如 item-not-found）→ 空结果 + error，不抛"""
    from sku_provider import parse_onebound
    r = parse_onebound({"error_code": "2000", "reason": "item-not-found"})
    assert r["sku_count"] == 0
    assert "item-not-found" in r["error"]


def test_parse_onebound_garbage_input():
    """非 dict / 缺字段 → 空结果，绝不抛异常"""
    from sku_provider import parse_onebound
    assert parse_onebound(None)["sku_count"] == 0
    assert parse_onebound({})["error"] is not None


def test_spec_values_parsing():
    """properties_name 段提取规格值，兼容值含冒号"""
    from sku_provider import _spec_values
    assert _spec_values("0:0:颜色:浅灰色;1:1:尺码:S") == ["浅灰色", "S"]
    assert _spec_values("") == []


# ═══════════════════════════════════════════
# 5. config 集成：默认配置含 sku_provider 段
# ═══════════════════════════════════════════

def test_config_has_sku_provider_section():
    """load_sourcing_config 返回的配置含 sku_provider 段，默认 active 为空"""
    from config import reload_sourcing_config
    cfg = reload_sourcing_config()
    assert "sku_provider" in cfg
    assert cfg["sku_provider"].get("active") == ""


def test_get_provider_works_with_loaded_config():
    """工厂能直接消费 load_sourcing_config 的输出 → 默认 NullProvider"""
    from config import reload_sourcing_config
    from sku_provider import get_provider, NullProvider
    p = get_provider(reload_sourcing_config())
    assert isinstance(p, NullProvider)


def test_env_credentials_override_yaml_placeholder(monkeypatch):
    """env 注入的凭证必须盖过 sourcing.yaml 的空串占位（否则 onebound 永远 not ready）"""
    from config import reload_sourcing_config
    monkeypatch.setenv("ONEBOUND_KEY", "envkey")
    monkeypatch.setenv("ONEBOUND_SECRET", "envsecret")
    cfg = reload_sourcing_config()
    ob = cfg["sku_provider"]["onebound"]
    assert ob["key"] == "envkey"
    assert ob["secret"] == "envsecret"
    reload_sourcing_config()  # 清理缓存，避免污染后续用例
