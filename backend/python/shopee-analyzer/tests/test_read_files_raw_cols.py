"""_read_files 应同时保留原始中文列(供导出透传)与标准英文列(供内部计算)。

背景：原实现 rename 把「产品ID/产品名称/产品主图」等映射列的中文名删除，导致导出
左侧透传列整列为空，而分析区又用同名中文列补一遍 → 空列 + 重复列。
修复后这些映射列的原始中文名应仍带值存在于行内。

运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_read_files_raw_cols.py -v
"""
from io import BytesIO

import pandas as pd


class _FakeUpload:
    def __init__(self, df: pd.DataFrame, filename: str):
        buf = BytesIO()
        df.to_excel(buf, index=False)
        buf.seek(0)
        self.file = buf
        self.filename = filename


def _col_map():
    return {"产品ID": "product_id", "产品名称": "product_name",
            "产品主图": "image_url", "价格": "shopee_price_brl"}


def test_mapped_chinese_columns_survive_with_values():
    """映射列(产品ID 等)的原始中文名应保留且带值，同时英文标准列也存在。"""
    from sourcing import _read_files
    src = pd.DataFrame({
        "产品ID": ["P1"], "产品名称": ["红裙"], "产品主图": ["http://x/1.jpg"],
        "价格": ["R$ 39.90"], "商品类型": ["其它"],
    })
    df, raw_cols = _read_files([_FakeUpload(src, "a.xlsx")], _col_map())
    # 标准英文列存在(供内部计算)
    assert df.iloc[0]["product_id"] == "P1"
    # 原始中文列也保留且带值(供导出透传，不再是空列)
    assert df.iloc[0]["产品ID"] == "P1"
    assert df.iloc[0]["产品名称"] == "红裙"
    # 未映射的额外列照常保留
    assert df.iloc[0]["商品类型"] == "其它"
    # raw_cols 含原始中文列名
    assert "产品ID" in raw_cols and "商品类型" in raw_cols
