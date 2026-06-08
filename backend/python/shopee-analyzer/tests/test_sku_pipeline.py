"""
SKU 流水线单元测试 — _build_row 富化 + _pick_candidate 字段透传
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_sku_pipeline.py -v

注：SKU 价格表的获取已后端化为 SKU Provider，相关测试见
    test_sku_provider.py（provider 契约）与 test_build_rows_provider.py（注入/失败隔离）。
"""
import pytest


# ═══════════════════════════════════════════
# 1. _build_row 注入 SKU 缓存
# ═══════════════════════════════════════════

def test_build_row_with_sku_enrichment():
    """_build_row 将 sku_cache 注入候选，freight/trade 字段透传"""
    from sourcing import _build_row

    prod = {
        "product_id": "P1",
        "product_name": "测试商品",
        "image_url": "http://x.com/1.jpg",
        "shopee_price_brl": "R$ 19.90",
    }

    cand = {
        "itemId": "740919115663",
        "title": "候选1",
        "itemPrice": "7.40",
        "link": "http://x.com",
        "sales": "10",
        "offerTags": ["高度同款"],
        "purchaseInfos": [{"value": "2件起批"}],
        "imageUrl": "http://img.cdn/1.jpg",
        "providerInfo": {"companyName": "测试工厂"},
    }

    sku_cache = {
        "740919115663": {
            "sku_count": 5,
            "min_price": "7.40",
            "max_price": "10.00",
            "skus": [
                {"spec": "A", "full_spec": "A>大号", "price": "7.40", "can_book_count": 100, "sale_count": 0, "sku_id": 123},
                {"spec": "B", "full_spec": "B>大号", "price": "10.00", "can_book_count": 50, "sale_count": 10, "sku_id": 124},
            ],
            "freight": {"unit_weight_kg": 0.04, "total_cost_cny": 6.0, "location": "浙江"},
            "trade": {"begin_amount": 1, "min_price": "7.40", "max_price": "10.00", "price_display": "7.40-10.00"},
        }
    }

    cost_cfg = {"cny_per_brl": 1.35, "cost_multiplier": 1.3, "target_margin_rate": 0.15, "high_margin_rate": 0.30}
    row = _build_row(prod, [cand], cost_cfg, sku_cache)

    c = row["candidates"][0]
    assert c["sku"]["count"] == 5
    assert c["sku"]["min_price"] == "7.40"
    assert c["sku"]["items"][0]["price"] == "7.40"
    assert c["sku"]["items"][0]["can_book_count"] == 100
    assert c["sku"]["items"][0]["sale_count"] == 0
    assert row["has_1688_data"] is True


def test_build_row_sku_absent_still_works():
    """无 SKU 缓存时 _build_row 正常返回"""
    from sourcing import _build_row

    prod = {"product_id": "P1", "product_name": "X", "image_url": "", "shopee_price_brl": "10.00"}
    cand = {"itemId": "123", "title": "Y", "itemPrice": "5.00", "link": "", "sales": "", "offerTags": [], "purchaseInfos": [{"value": ""}], "providerInfo": {}}
    cost_cfg = {"cny_per_brl": 1.35, "cost_multiplier": 1.3, "target_margin_rate": 0.15, "high_margin_rate": 0.30}

    row = _build_row(prod, [cand], cost_cfg)

    assert row["candidates"][0]["sku"]["count"] == 0
    assert row["has_1688_data"] is True


# ═══════════════════════════════════════════
# 2. _pick_candidate 全字段透传
# ═══════════════════════════════════════════

def test_pick_candidate_all_fields():
    """_pick_candidate 保留所有原始字段 + SKU 默认空"""
    from sourcing import _pick_candidate

    c = {
        "title": "测试", "itemId": "12345", "itemPrice": "9.99",
        "link": "https://detail.1688.com/offer/12345.html",
        "offerDetailUrl": "https://detail.1688.com/offer/12345.html?spm=test",
        "imageUrl": "https://img.alicdn.com/test.jpg",
        "sales": "100", "salesNum": 100,
        "providerInfo": {"companyName": "测试工厂", "factoryUrl": "https://winport.1688.com/123", "memberId": "b2b-123", "loginId": "test123", "isLowRespRate": False, "providerTags": [{"tagCode": "FACTORY", "tagName": "源头工厂", "tagStyle": "FACTORY"}]},
        "purchaseInfos": [{"code": "o-qpl", "label": "起批量", "value": "2件起批", "originValue": 2.0}],
        "offerTags": ["高度同款"], "purchaseTags": ["先采后付"],
        "aiAttentions": ["✨爆款"], "coreAttributes": [{"label": "材质", "value": "毛绒"}],
        "salesInfos": [{"code": "o-xl", "label": "近一年销量", "value": "100"}],
        "shipInfos": [{"code": "fhd", "label": "发货地", "value": "浙江"}],
        "largeImageBaseInfos": [{"code": "TP", "label": "诚信通", "value": "5年"}],
        "largeImageExtraInfos": [{"code": "p-fwf", "label": "综合服务", "value": "4.1"}],
        "providerServices": [{"code": "p-tkl", "label": "退款率", "value": "0%"}],
        "providerKjCustomTags": ["演示视频"],
    }

    result = _pick_candidate(c)
    assert result["title"] == "测试"
    assert result["item_id"] == "12345"
    assert result["price_cny"] == "9.99"
    assert result["shop_name"] == "测试工厂"
    assert result["min_order"] == "2件起批"
    assert result["offer_tags"] == ["高度同款"]
    assert result["ai_attentions"] == ["✨爆款"]
    assert result["core_attributes"][0]["label"] == "材质"
    assert result["provider_tags"][0]["tagName"] == "源头工厂"
    assert result["sku"]["count"] == 0  # 默认空
