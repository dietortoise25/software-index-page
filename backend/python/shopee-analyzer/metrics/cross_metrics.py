"""跨数据源指标 — 以订单数据为可信源，补位店铺统计的空缺"""
import pandas as pd


def compute_product_from_orders(df_orders: pd.DataFrame) -> dict:
    """从订单明细计算商品矩阵（订单为可信数据源）"""
    if df_orders.empty:
        return {"items": [], "top1_share": 0, "top3_share": 0, "top5_share": 0, "product_count": 0}

    done = df_orders[df_orders['Status do pedido'] == 'Concluído'].copy()
    if done.empty:
        done = df_orders.copy()

    sku = done.groupby('sku_name').agg(
        orders=('ID do pedido', 'count'),
        revenue=('Valor Total', 'sum'),
        avg_price=('Valor Total', 'mean'),
    ).sort_values('revenue', ascending=False)

    total = float(sku['revenue'].sum())
    if total == 0:
        return {"items": [], "top1_share": 0, "top3_share": 0, "top5_share": 0, "product_count": 0}

    items = []
    cum = 0.0
    for name, row in sku.iterrows():
        share = round(float(row['revenue']) / total, 4)
        items.append({
            "id": "",
            "name": str(name),
            "status": "",
            "sales": round(float(row['revenue']), 2),
            "share": share,
            "impressions": 0,
            "clicks": 0,
            "orders": int(row['orders']),
            "ctr": None,
            "cvr": None,
        })

    top1 = items[0]['share'] if items else 0
    top3 = sum(i['share'] for i in items[:3]) if items else 0
    top5 = sum(i['share'] for i in items[:5]) if items else 0

    return {
        "items": items,
        "top1_share": top1,
        "top3_share": top3,
        "top5_share": top5,
        "product_count": len(items),
    }
