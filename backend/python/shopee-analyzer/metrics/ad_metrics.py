"""广告指标计算"""
import pandas as pd


def compute_ad_summary(df: pd.DataFrame) -> dict:
    if df.empty:
        return {
            "ad_count": 0, "total_spend": 0.0, "total_sales": 0.0,
            "roas": 0.0, "total_conversions": 0, "total_impressions": 0,
            "total_clicks": 0, "ctr": 0.0, "cvr": 0.0,
            "zero_conv_count": 0, "zero_conv_spend": 0.0,
            "high_roas_ads": [],
        }

    total_spend = float(df['花费'].sum())
    total_sales = float(df['销售金额'].sum())
    total_impressions = int(df['展示次数'].sum())
    total_clicks = int(df['点击数'].sum())
    total_conversions = int(df['转化'].sum())
    roas = round(total_sales / total_spend, 2) if total_spend > 0 else 0.0
    ctr = round(total_clicks / total_impressions, 4) if total_impressions > 0 else 0.0
    cvr = round(total_conversions / total_clicks, 4) if total_clicks > 0 else 0.0

    zero_conv = df[df['转化'] == 0]
    zero_conv_count = len(zero_conv)
    zero_conv_spend = round(float(zero_conv['花费'].sum()), 2)

    high_roas = df[df['广告支出回报率'] >= 10]
    high_roas_ads = []
    for _, row in high_roas.iterrows():
        high_roas_ads.append({
            "ad_name": str(row.get('广告名称', ''))[:80],
            "spend": round(float(row['花费']), 2),
            "sales": round(float(row['销售金额']), 2),
            "roas": round(float(row['广告支出回报率']), 2),
        })

    return {
        "ad_count": len(df),
        "total_spend": round(total_spend, 2),
        "total_sales": round(total_sales, 2),
        "roas": roas,
        "total_conversions": total_conversions,
        "total_impressions": total_impressions,
        "total_clicks": total_clicks,
        "ctr": ctr,
        "cvr": cvr,
        "zero_conv_count": zero_conv_count,
        "zero_conv_spend": zero_conv_spend,
        "high_roas_ads": high_roas_ads,
    }
