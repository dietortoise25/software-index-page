"""
SKU Provider 抽象层 — 可插拔的第三方 1688 SKU 价格表数据源

契约: fetch_sku(item_id) -> {
    "sku_count": int,
    "min_price": str | None,
    "max_price": str | None,
    "min_price_spec": str | None,
    "skus": list[dict],
    "error": str | None,   # 失败时填，调用方据此暴露状态、不阻塞工作流
}

选型由 config 的 sku_provider.active 决定。未配置 / 未实现时返回带 error
的空结果，绝不抛异常 —— 单个 offer 失败不应中断整批分析。
"""
import json
import logging
import os
import threading
import hashlib
import urllib.parse
import urllib.request
from typing import Any

logger = logging.getLogger("sku_provider")


def _empty(error: str | None = None) -> dict[str, Any]:
    """统一契约的空结果"""
    return {
        "sku_count": 0,
        "min_price": None,
        "max_price": None,
        "min_price_spec": None,
        "skus": [],
        "error": error,
    }


class SkuProvider:
    """Provider 基类，定义统一契约"""
    name: str = "base"
    ready: bool = False

    def fetch_sku(self, item_id: str) -> dict[str, Any]:
        raise NotImplementedError


class NullProvider(SkuProvider):
    """未配置任何 provider 时的占位 —— 返回空结果 + 未配置状态"""
    name = "none"
    ready = False

    def fetch_sku(self, item_id: str) -> dict[str, Any]:
        return _empty("未配置 SKU Provider")


def _to_float(s: Any) -> float | None:
    try:
        return float(str(s))
    except (TypeError, ValueError):
        return None


def _spec_values(properties_name: str) -> list[str]:
    """从 onebound properties_name 提取规格值。
    "0:0:颜色:浅灰色;1:1:尺码:S" -> ["浅灰色", "S"]"""
    vals = []
    for seg in (properties_name or "").split(";"):
        seg = seg.strip()
        if not seg:
            continue
        parts = seg.split(":")
        # 段格式: code:code:propName:propValue —— 取值(允许值含冒号)
        vals.append(":".join(parts[3:]).strip() if len(parts) >= 4 else parts[-1].strip())
    return [v for v in vals if v]


def parse_onebound(resp: dict[str, Any]) -> dict[str, Any]:
    """万邦 1688.item_get 响应 -> 统一契约。纯函数, 不抛异常。"""
    if not isinstance(resp, dict):
        return _empty("onebound 返回非预期格式")
    code = str(resp.get("error_code", ""))
    if code != "0000":
        reason = resp.get("reason") or resp.get("error") or f"error_code={code}"
        return _empty(f"onebound: {str(reason)[:120]}")

    item = resp.get("item") or {}
    raw_skus = ((item.get("skus") or {}).get("sku")) or []
    skus = []
    for s in raw_skus:
        vals = _spec_values(s.get("properties_name", ""))
        skus.append({
            "spec": vals[0] if vals else "",
            "full_spec": " / ".join(vals),
            "price": str(s.get("price", "")),
            "can_book_count": s.get("quantity", 0),
            "sku_id": s.get("sku_id"),
        })

    priced = sorted(
        ((_to_float(x["price"]), x) for x in skus if _to_float(x["price"]) is not None),
        key=lambda t: t[0],
    )
    if priced:
        min_price = priced[0][1]["price"]
        max_price = priced[-1][1]["price"]
        min_price_spec = priced[0][1]["spec"]
    else:
        ip = item.get("price")
        min_price = max_price = (str(ip) if ip not in (None, "") else None)
        min_price_spec = None

    return {
        "sku_count": len(skus),
        "min_price": min_price,
        "max_price": max_price,
        "min_price_spec": min_price_spec,
        "skus": skus,
        "error": None,
    }


class OneboundProvider(SkuProvider):
    """万邦(onebound) 1688.item_get —— 提供分规格单价/库存/skuId"""
    name = "onebound"
    BASE_URL = "https://api-gw.onebound.cn/1688/item_get"

    def __init__(self, conf: dict[str, Any] | None = None):
        conf = conf or {}
        self._key = conf.get("key", "")
        self._secret = conf.get("secret", "")
        self.ready = bool(self._key and self._secret)

    def _request(self, item_id: str) -> dict[str, Any]:
        params = urllib.parse.urlencode({
            "key": self._key, "secret": self._secret,
            "num_iid": item_id, "lang": "cn",
        })
        with urllib.request.urlopen(f"{self.BASE_URL}?{params}", timeout=40) as r:
            raw = r.read()
        try:
            return json.loads(raw.decode("utf-8"))
        except UnicodeDecodeError:
            return json.loads(raw.decode("gbk"))  # 万邦报错信息常为 GBK

    def fetch_sku(self, item_id: str) -> dict[str, Any]:
        try:
            resp = self._request(item_id)
        except Exception as e:
            logger.warning(f"[onebound] {item_id} 请求失败: {e}")
            return _empty(f"onebound 请求失败: {str(e)[:120]}")
        # HTTP 200 但 body 含错误码（如 4013 配额超限）：parse 返回带 error 的空结果
        if str(resp.get("error_code", "")) == "4013":
            reason = resp.get("reason") or resp.get("error") or "Key 调用量超限"
            logger.warning(f"[onebound] {item_id} 万邦配额已耗尽(4013): {str(reason)[:160]}")
            return _empty(f"万邦配额已耗尽(4013): {str(reason)[:120]}")
        result = parse_onebound(resp)
        if result["error"] is not None:
            logger.warning(f"[onebound] {item_id} 返回错误，无 SKU: {result['error']}")
        return result


class JustOneApiProvider(SkuProvider):
    """JustOneAPI 详情接口 —— TODO: 待接入，补 token 后实现请求逻辑"""
    name = "justoneapi"

    def __init__(self, conf: dict[str, Any] | None = None):
        conf = conf or {}
        self._token = conf.get("token", "")
        self.ready = bool(self._token)

    def fetch_sku(self, item_id: str) -> dict[str, Any]:
        # TODO(provider): 调 JustOneAPI 1688 商品详情接口，传 item_id，
        #   解析其 SKU 结构 -> 统一契约字段。鉴权 token。
        return _empty("justoneapi provider 未实现")


class MockProvider(SkuProvider):
    """本地确定性假数据源 —— 配额耗尽/离线时不阻塞开发。
    无需凭证即就绪；同一 item_id 总返回同一结果（用 id 哈希出稳定的规格/价格）。"""
    name = "mock"
    ready = True

    _COLORS = ["黑色", "白色", "藏青", "卡其", "酒红", "墨绿"]
    _SIZES = ["S", "M", "L", "XL", "均码"]

    def __init__(self, conf: dict[str, Any] | None = None):
        self.ready = True

    def fetch_sku(self, item_id: str) -> dict[str, Any]:
        # 用 item_id 哈希派生确定性数据（不依赖 random 全局状态）
        h = int(hashlib.md5(str(item_id).encode()).hexdigest(), 16)
        n = 2 + h % 5  # 2~6 个 SKU
        skus = []
        for i in range(n):
            hi = (h >> (i * 5)) & 0xFFFF
            color = self._COLORS[hi % len(self._COLORS)]
            size = self._SIZES[(hi // 7) % len(self._SIZES)]
            price = round(2.0 + (hi % 1800) / 100.0, 2)  # 2.00~19.99
            skus.append({
                "spec": color,
                "full_spec": f"{color} / {size}",
                "price": f"{price:.2f}",
                "can_book_count": 50 + hi % 950,
                "sku_id": h % 10_000_000 + i,
            })
        prices = sorted(skus, key=lambda s: float(s["price"]))
        return {
            "sku_count": n,
            "min_price": prices[0]["price"],
            "max_price": prices[-1]["price"],
            "min_price_spec": prices[0]["spec"],
            "skus": skus,
            "error": None,
        }


_REGISTRY = {
    "onebound": OneboundProvider,
    "justoneapi": JustOneApiProvider,
    "mock": MockProvider,
}


class CachedProvider(SkuProvider):
    """透明缓存装饰器：命中本地 JSON 直接返回，未命中才真调内层 provider 并写盘。
    MVP：无 TTL（缓存永久有效）。只缓存成功结果（error 为 None），
    失败不入缓存，下次仍可重试。name/ready 透传内层，对下游无感。"""

    def __init__(self, inner: SkuProvider, cache_path: str):
        self._inner = inner
        self._path = cache_path
        self.name = inner.name
        self.ready = inner.ready
        self._lock = threading.Lock()
        self._cache = self._load()

    def _load(self) -> dict[str, Any]:
        if not os.path.exists(self._path):
            return {}
        try:
            with open(self._path, encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except (json.JSONDecodeError, OSError) as e:
            logger.warning(f"[sku_cache] 读取 {self._path} 失败，按空缓存处理: {e}")
            return {}

    def _save(self) -> None:
        try:
            tmp = f"{self._path}.tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self._cache, f, ensure_ascii=False)
            os.replace(tmp, self._path)
        except OSError as e:
            logger.warning(f"[sku_cache] 写入 {self._path} 失败: {e}")

    def fetch_sku(self, item_id: str) -> dict[str, Any]:
        with self._lock:
            if item_id in self._cache:
                return self._cache[item_id]
        result = self._inner.fetch_sku(item_id)  # 网络调用不持锁，允许并发
        if result.get("error") is None:
            with self._lock:
                self._cache[item_id] = result
                self._save()
        return result


def get_provider(config: dict[str, Any]) -> SkuProvider:
    """按 config['sku_provider']['active'] 选择 provider；未知/空 → NullProvider。
    若 cache.enabled 且 provider 就绪，则套一层 CachedProvider。"""
    sp = (config or {}).get("sku_provider", {}) or {}
    active = sp.get("active", "")
    cls = _REGISTRY.get(active)
    if cls is None:
        if active:
            logger.warning(f"[sku_provider] 未知 provider '{active}'，回退 NullProvider")
        return NullProvider()
    base = cls(sp.get(active, {}))
    cache = sp.get("cache") or {}
    # mock 是本地确定性数据，缓存无意义且会污染真实缓存文件 → 不包装
    if cache.get("enabled") and base.ready and not isinstance(base, MockProvider):
        return CachedProvider(base, cache.get("path", "sku_cache.json"))
    return base
