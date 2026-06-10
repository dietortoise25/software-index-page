"""
成本/利润/推荐等级 纯计算函数 — 从 sourcing.py 抽出，无 IO / 无网络 / 无文件。

行为与原 sourcing._calc_cost 完全一致（纯搬运 + 复用）。
"""

from typing import Optional

import pandas as pd

# 图文核对置信度阈值：< 此值的候选不准当 best_1688
DEFAULT_VERIFY_THRESHOLD = 0.5


def parse_shopee_price(val) -> Optional[float]:
    """R$ 19,90 → 19.9"""
    if pd.isna(val):
        return None
    s = str(val).replace("R$", "").strip()
    parts = s.split("~")
    try:
        return float(parts[0].replace(",", ""))
    except (ValueError, IndexError):
        return None


def to_cost_float(val) -> Optional[float]:
    """SKU 单价字符串 → float，空/非法 → None"""
    if val is None or val == "":
        return None
    try:
        return float(str(val).replace(",", ""))
    except (TypeError, ValueError):
        return None


def calc_cost(row: dict, cost_cfg: dict) -> dict:
    """采购成本 = 1688价(数值) × 倍率，直接标 R$（按老板要求不算汇率）"""
    mult = cost_cfg["cost_multiplier"]
    target = cost_cfg["target_margin_rate"]
    high = cost_cfg["high_margin_rate"]

    best_1688 = row.get("best_1688") or {}
    # 成本来自 step4 选中的 SKU 真实单价（弃用图搜 itemPrice/price_cny —— 无用且常空）
    matched_sku = best_1688.get("matched_sku") or {}
    sku_price = matched_sku.get("price")
    cost_cny = to_cost_float(sku_price)
    cost_brl = (cost_cny * mult) if cost_cny is not None else None

    shopee_price = row.get("shopee_price_num")
    margin_brl = (shopee_price - cost_brl) if (shopee_price is not None and cost_brl is not None) else None
    margin_rate = (margin_brl / shopee_price) if (shopee_price and margin_brl is not None) else None

    if shopee_price is None or cost_cny is None:
        rec = "待补全"
    elif margin_rate is not None and margin_rate >= high:
        rec = "推荐"
    elif margin_rate is not None and margin_rate >= target:
        rec = "可考虑"
    else:
        rec = "预警"

    # 图文置信度低于核对阈值 → 疑似错配，降级（避免「疑似不符却标推荐」的矛盾）
    verify_threshold = cost_cfg.get("verify_threshold", DEFAULT_VERIFY_THRESHOLD)
    image_conf = best_1688.get("image_confidence")
    if image_conf is not None and image_conf < verify_threshold and rec in ("推荐", "可考虑"):
        rec = "疑似不符"

    return {
        "cost_cny": round(cost_cny, 2) if cost_cny else None,
        "cost_brl": round(cost_brl, 2) if cost_brl else None,
        "cost_multiplier": mult,
        "total_cost_brl": round(cost_brl, 2) if cost_brl else None,
        "shopee_price_num": shopee_price,
        "margin_brl": round(margin_brl, 2) if margin_brl is not None else None,
        "margin_rate": round(margin_rate, 4) if margin_rate is not None else None,
        "recommendation": rec,
    }
