"""预算重分配模拟 — 纯计算，无依赖，可被任何前端调用"""


def run_simulation(ad_metrics: dict, realloc_pct: float = 70) -> dict:
    """输入广告指标，输出预算重分配模拟对比"""
    total_spend = ad_metrics.get("total_spend", 0)
    total_sales = ad_metrics.get("total_sales", 0)
    roas = ad_metrics.get("roas", 0)
    zero_conv_spend = ad_metrics.get("zero_conv_spend", 0)
    high_roas_ads = ad_metrics.get("high_roas_ads", [])

    if not total_spend or not zero_conv_spend or not high_roas_ads:
        return {
            "feasible": False,
            "reason": "缺少零转化广告或高ROAS广告数据",
            "baseline": {"roas": roas, "spend": total_spend, "sales": total_sales},
            "optimized": None,
        }

    avg_roas = sum(a.get("roas", 0) for a in high_roas_ads) / len(high_roas_ads)
    realloc_amt = zero_conv_spend * (realloc_pct / 100)
    new_sales = total_sales + realloc_amt * avg_roas
    new_roas = round(new_sales / total_spend, 2)

    return {
        "feasible": True,
        "baseline": {
            "roas": round(roas, 2),
            "spend": round(total_spend, 2),
            "sales": round(total_sales, 2),
        },
        "optimized": {
            "roas": new_roas,
            "spend": round(total_spend, 2),
            "sales": round(new_sales, 2),
        },
        "realloc_amount": round(realloc_amt, 2),
        "zero_conv_spend": round(zero_conv_spend, 2),
        "avg_roas_top": round(avg_roas, 2),
        "improvement_pct": round((new_roas - roas) / roas * 100, 1) if roas > 0 else 0,
    }
