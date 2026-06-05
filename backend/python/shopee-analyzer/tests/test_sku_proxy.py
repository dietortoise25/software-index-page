"""
TDD: SKU 代理集成测试
运行: cd backend/python/shopee-analyzer && python3 -m pytest tests/test_sku_proxy.py -v
"""
import json
import pytest
from unittest.mock import patch, MagicMock


# ─── fetch_sku_prices 代理模式 ───

def test_fetch_sku_via_proxy_returns_prices():
    """代理在线 → 请求正确发到 proxy URL → 返回 SKU 数据"""
    from aibuy_client import fetch_sku_prices, set_auth_cookie

    set_auth_cookie("_m_h5_tk=test123_123456; cookie2=abc;")  # 设置认证 cookie

    mock_response = {
        "ret": ["SUCCESS::调用成功"],
        "data": {
            "skuSelectorBizModel": {
                "skuInfoMap": {
                    "红色&gt;大号": {"price": "10.00", "canBookCount": 100, "skuId": 123},
                    "蓝色&gt;大号": {"price": "8.00", "canBookCount": 50, "skuId": 124},
                }
            }
        },
    }

    with patch("aibuy_client.urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(mock_response).encode()
        mock_urlopen.return_value = mock_resp

        # 关键：验证请求 URL 指向 proxy
        result = fetch_sku_prices("740919115663")

        # 验证 URL 包含了正确的参数
        called_req = mock_urlopen.call_args[0][0]
        url = called_req.get_full_url()
        assert "mtop.1688.wosc.queryofferskuselectormodel" in url
        assert "appKey=12574478" in url
        assert "data=" in url

    assert result["sku_count"] == 2
    assert result["min_price"] == "8.00"
    assert result["max_price"] == "10.00"
    assert result["min_price_spec"] == "蓝色"
    assert len(result["skus"]) == 2


def test_fetch_sku_no_cookie_returns_empty():
    """未设置 cookie → 返回空，不报错"""
    from aibuy_client import fetch_sku_prices, set_auth_cookie

    set_auth_cookie("")  # 清空 cookie

    result = fetch_sku_prices("123456")
    assert result["sku_count"] == 0
    assert result["min_price"] is None


def test_fetch_sku_api_error_handled():
    """API 抛异常 → 返回空 + error 字段，不炸"""
    from aibuy_client import fetch_sku_prices, set_auth_cookie

    set_auth_cookie("_m_h5_tk=test123_123456;")

    with patch("aibuy_client.urllib.request.urlopen", side_effect=Exception("timeout")):
        result = fetch_sku_prices("123456")

    assert result["sku_count"] == 0
    assert "timeout" in result["error"]


# ─── _build_rows 注入 SKU 缓存 ───

def test_build_rows_injects_sku_into_candidates():
    """_build_rows 将 sku_cache 注入到每个候选"""
    from sourcing import _build_row

    prod = {"product_id": "P1", "product_name": "测试商品", "image_url": "http://x.com/1.jpg", "shopee_price_brl": "19.90"}
    cands = [{"itemId": "740919115663", "title": "候选1", "itemPrice": "7.40", "link": "http://x.com", "sales": "10", "offerTags": ["高度同款"], "purchaseInfos": [{"value": "2件"}]}]

    sku_cache = {
        "740919115663": {
            "sku_count": 2,
            "min_price": "7.40",
            "max_price": "10.00",
            "min_price_spec": "红橙",
            "skus": [
                {"spec": "红橙", "full_spec": "红橙>大号", "price": "7.40", "can_book_count": 100, "sku_id": 123},
                {"spec": "蓝色", "full_spec": "蓝色>大号", "price": "10.00", "can_book_count": 50, "sku_id": 124},
            ],
        }
    }

    cost_cfg = {
        "cny_per_brl": 1.35,
        "cost_multiplier": 1.3,
        "target_margin_rate": 0.15,
        "high_margin_rate": 0.30,
    }

    row = _build_row(prod, cands, cost_cfg, sku_cache)

    assert row["product_id"] == "P1"
    c = row["candidates"][0]
    assert c["sku"]["count"] == 2
    assert c["sku"]["min_price"] == "7.40"
    assert c["sku"]["min_price_spec"] == "红橙"
    assert len(c["sku"]["items"]) == 2


# ─── Proxy 状态检测 ───

def test_proxy_status_online():
    """proxy 在线 → healthcheck 返回 ok"""
    # 这里测的是后端 /api/sourcing/proxy/healthcheck 的逻辑
    # 后端 GET localhost:8766/health → 在线
    with patch("sourcing.urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"status":"ok"}'
        mock_resp.status = 200
        mock_urlopen.return_value = mock_resp

        from sourcing import _check_proxy_alive
        assert _check_proxy_alive("http://localhost:8766") is True


def test_proxy_status_offline():
    """proxy 离线 → healthcheck 返回 failed"""
    with patch("sourcing.urllib.request.urlopen", side_effect=Exception("Connection refused")):
        from sourcing import _check_proxy_alive
        assert _check_proxy_alive("http://localhost:8766") is False


# ─── _pick_candidate 完整字段 ───

def test_pick_candidate_all_fields():
    """_pick_candidate 透传所有 1688 字段"""
    from sourcing import _pick_candidate

    c = {
        "title": "测试商品",
        "itemId": "12345",
        "itemPrice": "9.99",
        "link": "https://detail.1688.com/offer/12345.html",
        "offerDetailUrl": "https://detail.1688.com/offer/12345.html?spm=test",
        "imageUrl": "https://img.alicdn.com/test.jpg",
        "sales": "100",
        "salesNum": 100,
        "providerInfo": {
            "companyName": "测试工厂",
            "factoryUrl": "https://winport.1688.com/123",
            "memberId": "b2b-123",
            "loginId": "test123",
            "isLowRespRate": False,
            "providerTags": [{"tagCode": "FACTORY", "tagName": "源头工厂", "tagStyle": "FACTORY"}],
        },
        "purchaseInfos": [{"code": "o-qpl", "label": "起批量", "value": "2件起批", "originValue": 2.0}],
        "offerTags": ["高度同款"],
        "purchaseTags": ["先采后付"],
        "aiAttentions": ["✨爆款"],
        "coreAttributes": [{"label": "材质", "value": "毛绒"}],
        "salesInfos": [{"code": "o-xl", "label": "近一年销量", "value": "100"}],
        "shipInfos": [{"code": "fhd", "label": "发货地", "value": "浙江"}],
        "largeImageBaseInfos": [{"code": "TP", "label": "诚信通", "value": "5年"}],
        "largeImageExtraInfos": [{"code": "p-fwf", "label": "综合服务", "value": "4.1"}],
        "providerServices": [{"code": "p-tkl", "label": "退款率", "value": "0%"}],
        "providerKjCustomTags": ["演示视频"],
    }

    result = _pick_candidate(c)

    assert result["title"] == "测试商品"
    assert result["item_id"] == "12345"
    assert result["price_cny"] == "9.99"
    assert result["shop_name"] == "测试工厂"
    assert result["min_order"] == "2件起批"
    assert result["offer_tags"] == ["高度同款"]
    assert result["ai_attentions"] == ["✨爆款"]
    assert result["core_attributes"][0]["label"] == "材质"
    assert result["provider_tags"][0]["tagName"] == "源头工厂"
    # SKU 默认为空
    assert result["sku"]["count"] == 0
