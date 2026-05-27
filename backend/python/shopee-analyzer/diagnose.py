"""规则引擎 — 读取YAML配置，输入指标dict，输出DiagnosticReport"""
import os
import yaml
from dataclasses import dataclass, field

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config", "diagnostic_rules.yaml")


@dataclass
class DiagnoseResult:
    overall_score: int = 100
    health_checks: list[dict] = field(default_factory=list)
    problems: list[dict] = field(default_factory=list)
    ai_insights: None = None


def load_rules(path: str | None = None) -> list[dict]:
    path = path or CONFIG_PATH
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    return config.get("rules", [])


def _severity_score(severity: str) -> int:
    return {"critical": -20, "warning": -10, "info": -5}.get(severity, 0)


def _actions_for(rid: str, data: dict) -> list[dict]:
    """为每条诊断问题生成可执行的操作建议"""
    if rid == "zero_conversion_waste":
        return [
            {"type": "pause_ads", "label": f"暂停{data.get('ad_zero_conv_count', 0)}条零转化广告",
             "impact": f"节省R${data.get('ad_zero_conv_spend', 0):.2f}"},
            {"type": "reallocate", "label": "将预算转投至高ROAS商品",
             "impact": "预计ROAS从{:.1f}提升至17+".format(data.get("ad_roas", 0))},
            {"type": "export", "label": "导出零转化广告清单"},
        ]
    if rid == "cancel_rate_high":
        return [
            {"type": "investigate", "label": "分析取消原因：系统自动取消 vs 用户主动取消"},
            {"type": "optimize", "label": "检查高频取消商品的描述准确性、发货时效"},
        ]
    if rid == "zero_repeat_purchase":
        return [
            {"type": "remarket", "label": "通过Shopee聊天向已购买家发送优惠券"},
            {"type": "follow", "label": "引导买家关注店铺，建立复购触达通道"},
        ]
    if rid == "low_conversion_rate":
        return [
            {"type": "optimize", "label": "检查商品主图、标题、价格的竞争力"},
            {"type": "investigate", "label": "对比竞品转化率，确认是否类目普遍偏低"},
        ]
    if rid == "product_over_concentration":
        return [
            {"type": "diversify", "label": "对Top5以外的潜力商品增加广告投放"},
            {"type": "investigate", "label": "评估Top1商品断货/差评对整体生意的冲击风险"},
        ]
    if rid == "high_new_buyer_dependency":
        return [
            {"type": "remarket", "label": "对老买家推送新品或专属折扣"},
            {"type": "investigate", "label": "检查是否有复购障碍（发货慢/包装差/产品质量）"},
        ]
    if rid == "high_spend_no_conversion":
        return [
            {"type": "pause_ads", "label": "逐条审查高花费零转化广告的落地页和出价"},
            {"type": "export", "label": "导出高花费零转化广告明细"},
        ]
    if rid == "low_ad_ctr":
        return [
            {"type": "optimize", "label": "优化广告素材：更换主图、测试不同标题"},
            {"type": "investigate", "label": "检查广告定向是否匹配目标人群"},
        ]
    return []


def run_diagnose(data: dict, rules: list[dict]) -> DiagnoseResult:
    result = DiagnoseResult()
    score = 100

    for rule in rules:
        if not rule.get("enabled", True):
            continue
        rid = rule["id"]
        threshold = rule.get("threshold", 0)
        triggered = False

        if rid == "zero_conversion_waste":
            total = data.get("ad_total_spend", 0) or 1
            ratio = data.get("ad_zero_conv_spend", 0) / total
            triggered = ratio > threshold
            detail = f"{data.get('ad_zero_conv_count', 0)}条零转化广告花费R${data.get('ad_zero_conv_spend', 0):.2f}，占预算{ratio*100:.0f}%"

        elif rid == "cancel_rate_high":
            rate = data.get("store_cancel_rate", 0)
            triggered = rate > threshold
            detail = f"取消率{rate*100:.1f}%，超过阈值{threshold*100:.0f}%"

        elif rid == "zero_repeat_purchase":
            rate = data.get("store_repeat_rate", 0)
            triggered = rate < threshold
            detail = f"复购率{rate*100:.1f}%，低于阈值{threshold*100:.0f}%"

        elif rid == "low_conversion_rate":
            rate = data.get("store_conversion_rate", 0)
            triggered = rate < threshold
            detail = f"店铺转化率{rate*100:.2f}%，低于阈值{threshold*100:.0f}%"

        elif rid == "product_over_concentration":
            share = data.get("store_product_top5_share", 0)
            triggered = share > threshold
            detail = f"Top5商品占{share*100:.0f}%销售，超过{threshold*100:.0f}%"

        elif rid == "high_new_buyer_dependency":
            ratio = data.get("store_new_buyer_ratio", 0)
            triggered = ratio > threshold
            detail = f"新买家占比{ratio*100:.0f}%，超过{threshold*100:.0f}%"

        elif rid == "high_spend_no_conversion":
            count = data.get("ad_high_spend_zero_count", 0)
            triggered = count > 0
            detail = f"{count}条广告花费超R${threshold}但零转化"

        elif rid == "low_ad_ctr":
            ctr = data.get("ad_ctr", 0)
            triggered = ctr < threshold
            detail = f"广告平均CTR {ctr*100:.1f}%，低于{threshold*100:.0f}%"

        health = "pass"
        if triggered:
            health = rule.get("severity", "warning")
            score += _severity_score(health)
            result.problems.append({
                "id": rid,
                "title": rule["title"],
                "severity": health,
                "detail": detail,
                "description": rule.get("description", "").format(
                    threshold_pct=f"{threshold*100:.0f}%",
                    threshold_value=f"{threshold:.2f}",
                ),
                "confidence": "high",
                "impact_amount": data.get("ad_zero_conv_spend", 0) if rid == "zero_conversion_waste" else None,
                "actions": _actions_for(rid, data),
            })

        result.health_checks.append({
            "id": rid,
            "title": rule["title"],
            "health": health,
            "threshold": threshold,
            "anchor": rule.get("anchor", "baseline"),
        })

    result.problems.sort(key=lambda p: {"critical": 0, "warning": 1, "info": 2}.get(p["severity"], 99))
    result.overall_score = max(0, score)
    return result
