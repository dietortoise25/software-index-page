"""选品比价配置加载模块 — YAML 文件持久化，支持线上 GET/PUT 热更新"""
import os
from typing import Any

import yaml

_CONFIG_DIR = os.path.join(os.path.dirname(__file__), "config")
SOURCE_PATH = os.path.join(_CONFIG_DIR, "sourcing.yaml")

# 配置加载后缓存于此，文件不存在时用内置默认值
_cache: dict | None = None

_DEFAULTS: dict[str, Any] = {
    "api": {
        "app_key": "12574478",
        "customer_id": "wangxiaowang",
        "biz_type": "ERP",
        "language": "zh",
        "currency": "CNY",
        "platform": "1688",
    },
    "search": {
        "max_concurrency": 6,
        "page_size": 10,
        "same_style_only": True,
    },
    "cost": {
        "cny_per_brl": 1.35,
        "cost_multiplier": 1.3,
    },
    "thresholds": {
        "target_margin_rate": 0.15,
        "high_margin_rate": 0.30,
    },
    "system": {
        "proxy_url": "",
    },
    "sku_provider": {
        # active: "" | "onebound" | "justoneapi" —— 留空则用 NullProvider（SKU 列为空）
        "active": os.environ.get("SKU_PROVIDER_ACTIVE", ""),
        # 本地 JSON 缓存：命中不再调外部接口（省配额）。MVP 无 TTL。
        "cache": {
            "enabled": os.environ.get("SKU_CACHE_ENABLED", "1") != "0",
            "path": os.environ.get("SKU_CACHE_PATH", "sku_cache.json"),
        },
        # 密钥从 env 读，保留空字符串 fallback，禁止硬编码
        "onebound": {
            "key": os.environ.get("ONEBOUND_KEY", ""),
            "secret": os.environ.get("ONEBOUND_SECRET", ""),
        },
        "justoneapi": {
            "token": os.environ.get("JUSTONEAPI_TOKEN", ""),
        },
    },
    "limits": {
        "max_file_size_mb": 10,
    },
    "columns": {
        "产品ID": "product_id",
        "产品名称": "product_name",
        "产品主图": "image_url",
        "价格": "shopee_price_brl",
        "类目路径": "category_path",
        "月销量": "shopee_monthly_sales",
        "数据来源": "data_source",
    },
}


def deep_merge(base: dict, overlay: dict) -> dict:
    """递归合并，overlay 的值覆盖 base"""
    for k, v in overlay.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            base[k] = deep_merge(base[k].copy(), v)
        else:
            base[k] = v
    return base


def _apply_env_secrets(cfg: dict) -> None:
    """凭证以环境变量为准：env 非空则覆盖 YAML 占位。
    避免 sourcing.yaml 里的空串占位 deep_merge 时盖掉 env 注入的密钥。"""
    sp = cfg.setdefault("sku_provider", {})
    ob = sp.setdefault("onebound", {})
    if os.environ.get("ONEBOUND_KEY"):
        ob["key"] = os.environ["ONEBOUND_KEY"]
    if os.environ.get("ONEBOUND_SECRET"):
        ob["secret"] = os.environ["ONEBOUND_SECRET"]
    jo = sp.setdefault("justoneapi", {})
    if os.environ.get("JUSTONEAPI_TOKEN"):
        jo["token"] = os.environ["JUSTONEAPI_TOKEN"]
    if os.environ.get("SKU_PROVIDER_ACTIVE"):
        sp["active"] = os.environ["SKU_PROVIDER_ACTIVE"]


def load_sourcing_config() -> dict:
    """加载选品配置（带缓存）。文件不存在时返回内置默认值。"""
    global _cache
    if _cache is not None:
        return _cache

    if os.path.exists(SOURCE_PATH):
        with open(SOURCE_PATH, "r", encoding="utf-8") as f:
            file_cfg = yaml.safe_load(f) or {}
    else:
        file_cfg = {}

    _cache = deep_merge(_DEFAULTS.copy(), file_cfg)
    _apply_env_secrets(_cache)
    return _cache


def save_sourcing_config(cfg: dict) -> None:
    """保存选品配置到 YAML 文件，同时更新内存缓存"""
    global _cache
    with open(SOURCE_PATH, "w", encoding="utf-8") as f:
        yaml.safe_dump(cfg, f, allow_unicode=True, sort_keys=False)
    _cache = cfg


def reload_sourcing_config() -> dict:
    """强制重新加载配置（清除缓存）"""
    global _cache
    _cache = None
    return load_sourcing_config()
