"""
导入行数限制 — 用户在前端可配"仅分析前 N 行(留空=全部)",默认 20。
后端在解析出 products 后立即切片,后续搜图/SKU/图文核对/step4 全只跑这 N 行。
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_limit_products.py -v
"""


def _products(n):
    return [{"product_id": str(i)} for i in range(n)]


def test_limit_truncates_to_first_n():
    """limit=2 → 只保留前 2 行,且保持原顺序"""
    from sourcing import _limit_products
    out = _limit_products(_products(5), 2)
    assert [p["product_id"] for p in out] == ["0", "1"]


def test_limit_zero_means_all():
    """limit<=0 视为不限制,返回全部"""
    from sourcing import _limit_products
    assert len(_limit_products(_products(5), 0)) == 5
    assert len(_limit_products(_products(5), -1)) == 5


def test_limit_larger_than_len_returns_all():
    """limit 超过实际行数 → 返回全部,不报错"""
    from sourcing import _limit_products
    assert len(_limit_products(_products(3), 100)) == 3
