"""提取器测试：广告CSV → 清洗后DataFrame"""
import io
import pytest
from extractors.shopee_ads import extract_ads_overall


CSV_CONTENT = """所有CPC广告报告 - Shopee巴西
用户名称,r29tka3w9h
商店名称,Menta.Mood
商店ID,1583459562
报告创建时间,24/05/2026 23:19
时间,01/05/2026 - 24/05/2026

排序,广告名称,状态,广告类型,商品编号,创作,竞价方式,版位,开始日期,结束日期,展示次数,点击数,点击率,转化,直接转化,转化率,直接转化率,每转化成本,每一直接转化的成本,商品已出售,直接已售商品,销售金额,直接销售金额,花费,广告支出回报率,直接广告支出回报率,广告销售成本,直接广告销售成本,商品展示次数,商品点击数,商品点击率,Voucher Amount,Vouchered Sales
1,Test Ad A,正在进行,商品广告,SKU001,-,全站推广自定义ROAS,全部,14/04/2026 00:00:00,无限制,1000,50,5.00%,2,2,4.00%,4.00%,1.50,1.50,2,2,30.00,30.00,3.00,10.00,10.00,10.00%,10.00%,-,-,-
2,Test Ad B,正在进行,商品广告,SKU002,-,全站推广自定义ROAS,全部,14/04/2026 00:00:00,无限制,500,10,2.00%,0,0,0.00%,0.00%,0.00,0.00,0,0,0.00,0.00,1.50,0.00,0.00,0.00%,0.00%,-,-,-
"""


class TestExtractAdsOverall:
    def test_extracts_correct_row_count(self):
        buf = io.BytesIO(CSV_CONTENT.encode('utf-8'))
        df = extract_ads_overall(buf)
        assert len(df) == 2

    def test_extracts_columns(self):
        buf = io.BytesIO(CSV_CONTENT.encode('utf-8'))
        df = extract_ads_overall(buf)
        assert '花费' in df.columns
        assert '销售金额' in df.columns
        assert '广告支出回报率' in df.columns
        assert '转化' in df.columns

    def test_numeric_conversion(self):
        buf = io.BytesIO(CSV_CONTENT.encode('utf-8'))
        df = extract_ads_overall(buf)
        row0 = df.iloc[0]
        assert row0['花费'] == 3.00
        assert row0['销售金额'] == 30.00
        assert row0['展示次数'] == 1000
        assert row0['点击数'] == 50

    def test_empty_csv_returns_empty_df(self):
        buf = io.BytesIO(b'\xef\xbb\xbfall headers only\n\ncol1,col2\n')
        df = extract_ads_overall(buf)
        assert len(df) == 0
