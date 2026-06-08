"""
sku_provider.active 的 env 与 YAML/前端 优先级
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_config_active.py -v

背景：active 原先被 env(SKU_PROVIDER_ACTIVE) 强制覆盖，导致前端 PUT /config
写入的 active 被打回。改造后：env 只作默认值，YAML/前端显式设置优先；凭证仍 env 优先。
"""
import importlib


def test_env_does_not_override_explicit_active(monkeypatch):
    """env 设了 onebound，但配置(来自前端/YAML)显式设为 mock → 保持 mock"""
    monkeypatch.setenv("SKU_PROVIDER_ACTIVE", "onebound")
    import config
    importlib.reload(config)
    cfg = {"sku_provider": {"active": "mock"}}
    config._apply_env_secrets(cfg)
    assert cfg["sku_provider"]["active"] == "mock"


def test_credentials_still_env_overridden(monkeypatch):
    """凭证仍以 env 为准：env 的 ONEBOUND_KEY 覆盖 YAML 占位"""
    monkeypatch.setenv("ONEBOUND_KEY", "real-key")
    monkeypatch.setenv("ONEBOUND_SECRET", "real-secret")
    import config
    importlib.reload(config)
    cfg = {"sku_provider": {"active": "mock", "onebound": {"key": "", "secret": ""}}}
    config._apply_env_secrets(cfg)
    assert cfg["sku_provider"]["onebound"]["key"] == "real-key"
    assert cfg["sku_provider"]["onebound"]["secret"] == "real-secret"
    # 凭证被覆盖，但 active 不受影响
    assert cfg["sku_provider"]["active"] == "mock"
