"""店铺指标计算层 — 输入DataFrame，输出指标dict"""
import pandas as pd


def _nan_to_none(val):
    if isinstance(val, float):
        return None if pd.isna(val) else round(val, 4)
    return val


def _df_to_records(df, columns=None):
    if df is None or df.empty:
        return []
    cols = columns or df.columns.tolist()
    records = []
    for _, row in df[cols].iterrows():
        rec = {}
        for c in cols:
            v = row[c]
            if isinstance(v, pd.Timestamp):
                rec[c] = v.strftime("%Y-%m-%d")
            elif isinstance(v, float) and pd.isna(v):
                rec[c] = None
            elif isinstance(v, float):
                rec[c] = round(v, 4)
            else:
                rec[c] = v
        records.append(rec)
    return records


def compute_orders_data(df: pd.DataFrame) -> dict:
    if df.empty:
        return {"summary": {}, "daily": []}

    total_sales = float(df["销售额 (BRL)"].sum())
    total_orders = int(df["订单数"].sum())
    aov = round(total_sales / total_orders, 2) if total_orders > 0 else 0
    subsidy = round(total_sales - float(df["销售额（扣除Shopee补贴）"].sum()), 2)
    subsidy_rate = round(subsidy / total_sales, 4) if total_sales > 0 else 0

    cancelled_orders = int(df["已取消的订单"].sum())
    cancel_rate = round(cancelled_orders / (total_orders + cancelled_orders), 4) if (total_orders + cancelled_orders) > 0 else 0

    returned_orders = int(df["已退货/退款的订单"].sum())
    return_rate = round(returned_orders / total_orders, 4) if total_orders > 0 else 0

    sales_days = int((df["销售额 (BRL)"] > 0).sum())

    daily_cols = ["日期", "销售额 (BRL)", "订单数", "商品点击量", "访客数",
                   "订单转化率", "买家数", "新买家数", "潜在买家数"]
    daily = _df_to_records(df, [c for c in daily_cols if c in df.columns])

    total_visitors = int(df["访客数"].sum()) if "访客数" in df.columns else 0
    total_clicks = int(df["商品点击量"].sum()) if "商品点击量" in df.columns else 0
    conversion_rate = round(total_orders / total_visitors, 4) if total_visitors > 0 else 0
    click_to_order_rate = round(total_orders / total_clicks, 4) if total_clicks > 0 else 0

    return {
        "summary": {
            "total_sales": total_sales,
            "total_orders": total_orders,
            "aov": aov,
            "subsidy": subsidy,
            "subsidy_rate": subsidy_rate,
            "cancelled_orders": cancelled_orders,
            "cancel_rate": cancel_rate,
            "returned_orders": returned_orders,
            "return_rate": return_rate,
            "sales_days": sales_days,
            "total_days": len(df),
            "total_visitors": total_visitors,
            "total_clicks": total_clicks,
            "conversion_rate": conversion_rate,
            "click_to_order_rate": click_to_order_rate,
        },
        "daily": daily,
    }


def compute_traffic_data(traffic: pd.DataFrame, source_dist: pd.DataFrame) -> dict:
    if traffic.empty:
        return {"card": {}, "channels": [], "source_daily": []}

    card_data = traffic[traffic["section"] == "商品卡"].copy()
    if card_data.empty:
        return {"card": {}, "channels": [], "source_daily": []}

    agg = card_data[card_data["流量来源"] == "商品卡"]
    if not agg.empty:
        total_impressions = int(agg["商品曝光量"].iloc[0])
        total_clicks = int(agg["商品点击量"].iloc[0])
        total_pv_orders = int(agg["订单数"].iloc[0])
    else:
        total_impressions = int(card_data["商品曝光量"].sum())
        total_clicks = int(card_data["商品点击量"].sum())
        total_pv_orders = int(card_data["订单数"].sum())

    # 兜底：Sheet 2 聚合行可能全零，用 Sheet 3 来源分布日明细汇总
    if total_impressions == 0 and not source_dist.empty:
        sd_card = source_dist[source_dist["来源"] == "商品卡"]
        if not sd_card.empty:
            total_impressions = int(sd_card["商品曝光量"].sum())
            total_clicks = int(sd_card["商品点击量"].sum())
            total_pv_orders = int(sd_card["订单数"].sum())

    ctr = round(total_clicks / total_impressions, 4) if total_impressions > 0 else 0
    cvr = round(total_pv_orders / total_clicks, 4) if total_clicks > 0 else 0

    # 渠道明细：优先用 Sheet2，空则从 Sheet3 汇总补
    detail = card_data[card_data["流量来源"] != "商品卡"].copy()
    channels = []
    for _, row in detail.iterrows():
        channels.append({
            "name": str(row.get("流量来源", "")),
            "sales": _nan_to_none(row.get("销售 (BRL)", 0)),
            "share": _nan_to_none(row.get("销售占比", 0)),
            "impressions": int(row.get("商品曝光量", 0)) if pd.notna(row.get("商品曝光量", 0)) else 0,
            "clicks": int(row.get("商品点击量", 0)) if pd.notna(row.get("商品点击量", 0)) else 0,
            "orders": int(row.get("订单数", 0)) if pd.notna(row.get("订单数", 0)) else 0,
            "ctr": _nan_to_none(row.get("点击率", 0)),
            "cvr": _nan_to_none(row.get("订单转化率", 0)),
        })
    if not channels and not source_dist.empty:
        sd_sources = source_dist[source_dist["来源"] != "商品卡"]
        if not sd_sources.empty:
            sd_grouped = sd_sources.groupby("来源").agg({
                "商品曝光量": "sum", "商品点击量": "sum", "订单数": "sum",
            }).reset_index()
            for _, row in sd_grouped.iterrows():
                imp = int(row["商品曝光量"])
                clk = int(row["商品点击量"])
                ord_ = int(row["订单数"])
                channels.append({
                    "name": str(row["来源"]),
                    "sales": None, "share": None,
                    "impressions": imp, "clicks": clk, "orders": ord_,
                    "ctr": round(clk / imp, 4) if imp > 0 else 0,
                    "cvr": round(ord_ / clk, 4) if clk > 0 else 0,
                })

    source_daily = []
    if not source_dist.empty:
        daily = source_dist[source_dist["类型"] == "日数据"].copy()
        if not daily.empty:
            daily_agg = daily.groupby(["来源", "日期"]).agg({
                "商品曝光量": "sum", "商品点击量": "sum", "订单数": "sum",
            }).reset_index()
            for _, row in daily_agg.iterrows():
                source_daily.append({
                    "source": str(row["来源"]),
                    "date": row["日期"].strftime("%Y-%m-%d") if isinstance(row["日期"], pd.Timestamp) else str(row["日期"]),
                    "impressions": int(row["商品曝光量"]),
                    "clicks": int(row["商品点击量"]),
                    "orders": int(row["订单数"]),
                })

    return {
        "card": {
            "impressions": total_impressions,
            "clicks": total_clicks,
            "orders": total_pv_orders,
            "ctr": ctr,
            "cvr": cvr,
        },
        "channels": channels,
        "source_daily": source_daily,
    }


def compute_product_data(products: pd.DataFrame) -> dict:
    if products.empty:
        return {"items": [], "top1_share": 0, "top3_share": 0, "top5_share": 0}

    card = products[products["section"] == "商品卡"].sort_values("销售 (BRL)", ascending=False)
    if card.empty:
        return {"items": [], "top1_share": 0, "top3_share": 0, "top5_share": 0}

    top1_share = round(float(card["销售占比"].iloc[0]), 4) if "销售占比" in card.columns else 0
    top3_share = round(float(card["销售占比"].head(3).sum()), 4) if "销售占比" in card.columns else 0
    top5_share = round(float(card["销售占比"].head(5).sum()), 4) if "销售占比" in card.columns else 0

    items = []
    for _, row in card.iterrows():
        items.append({
            "id": str(row.get("商品编号", "")),
            "name": str(row.get("商品", "")),
            "status": str(row.get("Current Item Status", "")),
            "sales": _nan_to_none(row.get("销售 (BRL)", 0)),
            "share": _nan_to_none(row.get("销售占比", 0)),
            "impressions": int(row.get("商品曝光量", 0)) if pd.notna(row.get("商品曝光量", 0)) else 0,
            "clicks": int(row.get("商品点击量", 0)) if pd.notna(row.get("商品点击量", 0)) else 0,
            "orders": int(row.get("订单数", 0)) if pd.notna(row.get("订单数", 0)) else 0,
            "ctr": _nan_to_none(row.get("点击率", 0)),
            "cvr": _nan_to_none(row.get("订单转化率", 0)),
        })

    return {
        "items": items,
        "top1_share": top1_share,
        "top3_share": top3_share,
        "top5_share": top5_share,
        "product_count": len(card),
    }


def compute_user_data(df: pd.DataFrame) -> dict:
    if df.empty:
        return {}

    total_buyers = int(df["买家数"].sum())
    new_buyers = int(df["新买家数"].sum())
    existing_buyers = int(df["现有买家数量"].sum())
    potential_buyers = int(df["潜在买家数"].sum())
    repeat_rate = round(float(df["重复购买率"].mean()), 4)

    new_ratio = round(new_buyers / total_buyers, 4) if total_buyers > 0 else 0

    return {
        "total_buyers": total_buyers,
        "new_buyers": new_buyers,
        "existing_buyers": existing_buyers,
        "potential_buyers": potential_buyers,
        "new_ratio": new_ratio,
        "repeat_rate": repeat_rate,
    }
