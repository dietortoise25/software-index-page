"""Shopee 广告 CSV 数据提取器"""
import pandas as pd
from io import BytesIO


def extract_ads_overall(file_source: BytesIO) -> pd.DataFrame:
    try:
        df = pd.read_csv(file_source, skiprows=7, encoding='utf-8')
    except pd.errors.EmptyDataError:
        return pd.DataFrame()
    for c in ['花费', '销售金额', '展示次数', '点击数', '转化', '广告支出回报率', '点击率']:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c].astype(str).str.replace('%', ''), errors='coerce').fillna(0)
    if '点击率' in df.columns and df['点击率'].max() > 1:
        df['点击率'] = df['点击率'] / 100
    return df
