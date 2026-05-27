"""Shopee 店铺统计 Excel 提取器 — 读取8张工作表，清洗数据"""
import re
import logging
import pandas as pd

logger = logging.getLogger(__name__)


# ============================================================
# 工具函数：巴西数字格式解析
# ============================================================

def parse_br_number(s) -> float:
    if isinstance(s, (int, float)):
        return float(s) if pd.notna(s) else 0.0
    s = str(s).strip()
    if s in ("", "-", "--", "None", "nan"):
        return 0.0
    s = s.replace(" ", "")
    if "," in s:
        parts = s.rsplit(",", 1)
        integer_part = parts[0].replace(".", "")
        decimal_part = parts[1] if len(parts) > 1 else "0"
        try:
            return float(f"{integer_part}.{decimal_part}")
        except ValueError:
            return 0.0
    else:
        return float(s.replace(".", ""))


def parse_pct(s) -> float:
    if isinstance(s, (int, float)):
        if pd.isna(s):
            return 0.0
        return float(s) / 100 if float(s) > 1 else float(s)
    s = str(s).strip().replace("%", "").strip()
    if s in ("", "-", "--"):
        return 0.0
    return parse_br_number(s) / 100


def parse_int(s) -> int:
    if isinstance(s, (int, float)):
        return int(s) if pd.notna(s) else 0
    return int(parse_br_number(str(s)))


def cell_val(ws, row, col):
    v = ws.cell(row, col).value
    return str(v).strip() if v is not None else ""


def is_empty_row(vals):
    return all(v == "" for v in vals)


# ============================================================
# 数据清洗
# ============================================================

def clean_orders_daily(ws) -> pd.DataFrame:
    daily_start = None
    header_row = None
    for r in range(1, min(ws.max_row + 1, 20)):
        first = cell_val(ws, r, 1)
        if first == "日期":
            if header_row is not None:
                daily_start = r
                break
            header_row = r

    if daily_start is None:
        return pd.DataFrame()

    headers = [cell_val(ws, daily_start, c) for c in range(1, ws.max_column + 1)]
    rows = []
    for r in range(daily_start + 1, ws.max_row + 1):
        vals = [cell_val(ws, r, c) for c in range(1, ws.max_column + 1)]
        if not is_empty_row(vals):
            rows.append(dict(zip(headers, vals)))

    df = pd.DataFrame(rows)
    if df.empty:
        return df

    date_col = headers[0]
    date_mask = df[date_col].str.match(r"^\d{2}/\d{2}/\d{4}$")
    df = df[date_mask].copy()

    money_cols = [c for c in headers if "销售额" in c or "销售" in c and "每个" not in c]
    pct_cols = ["订单转化率", "重复购买率"]
    int_cols = ["订单数", "商品点击量", "访客数", "已取消的订单", "已退货/退款的订单",
                "买家数", "新买家数", "现有买家数量", "潜在买家数"]

    for col in money_cols:
        if col in df.columns:
            df[col] = df[col].apply(parse_br_number)
    if "每个订单的销售额" in df.columns:
        df["每个订单的销售额"] = df["每个订单的销售额"].apply(parse_br_number)
    for col in pct_cols:
        if col in df.columns:
            df[col] = df[col].apply(parse_pct)
    for col in int_cols:
        if col in df.columns:
            df[col] = df[col].apply(parse_int)

    df["日期"] = pd.to_datetime(df[date_col], format="%d/%m/%Y")
    return df.reset_index(drop=True)


def clean_orders_summary(ws) -> dict:
    for r in range(1, min(ws.max_row + 1, 5)):
        first = cell_val(ws, r, 1)
        if " - " in first or "/" in first:
            vals = {}
            for c in range(1, ws.max_column + 1):
                vals[cell_val(ws, 1, c)] = cell_val(ws, r, c)
            for k in vals:
                if k == "日期":
                    continue
                if "%" in str(vals[k]):
                    try:
                        vals[k] = parse_pct(vals[k])
                    except Exception:
                        pass
                else:
                    try:
                        vals[k] = parse_br_number(vals[k])
                    except Exception:
                        pass
            return vals
    return {}


def clean_traffic_source(ws) -> pd.DataFrame:
    SECTION_NAMES = ("商品卡", "卖家直播", "卖家视频", "联盟营销", "Shopee 广告")
    results = []
    current_section = ""
    current_headers = []
    in_data_zone = False

    for r in range(1, ws.max_row + 1):
        first = cell_val(ws, r, 1)
        second = cell_val(ws, r, 2)

        if first == "":
            in_data_zone = False
            continue

        if first in SECTION_NAMES and second == "":
            current_section = first
            in_data_zone = False
            continue

        if first == "流量来源":
            current_headers = [cell_val(ws, r, c) for c in range(1, ws.max_column + 1)]
            in_data_zone = True
            continue

        if in_data_zone and current_headers:
            row_data = {"section": current_section}
            for c in range(1, len(current_headers) + 1):
                row_data[current_headers[c - 1]] = cell_val(ws, r, c)
            results.append(row_data)

    df = pd.DataFrame(results)
    if df.empty:
        return df

    money_cols = ["销售 (BRL)", "每个订单的销售额"]
    pct_cols = ["销售占比", "点击率", "订单转化率"]
    int_cols = ["商品曝光量", "商品点击量", "订单数", "件数", "买家数",
                "直播观看次数", "直播观看人数", "视频观看次数", "视频观看人数",
                "内容观看次数", "内容观看人数", "不重复的商品曝光量", "不重复的商品点击量"]

    for col in money_cols:
        if col in df.columns:
            df[col] = df[col].apply(parse_br_number)
    for col in pct_cols:
        if col in df.columns:
            df[col] = df[col].apply(parse_pct)
    for col in int_cols:
        if col in df.columns:
            df[col] = df[col].apply(parse_int)

    return df.reset_index(drop=True)


def clean_source_distribution(ws) -> pd.DataFrame:
    results = []
    current_source = ""
    headers = []

    for r in range(1, ws.max_row + 1):
        first = cell_val(ws, r, 1)

        if first == "":
            continue

        if first == "流量来源":
            headers = [cell_val(ws, r, c) for c in range(1, ws.max_column + 1)]
            continue

        if re.match(r"^\d{2}/\d{2}/\d{4}$", first):
            if not headers:
                continue
            row_data = {"来源": current_source, "日期": first, "类型": "日数据"}
            for c in range(2, len(headers) + 1):
                row_data[headers[c - 1]] = cell_val(ws, r, c)
            results.append(row_data)
            continue

        if first and not is_empty_row([cell_val(ws, r, c) for c in range(1, min(5, ws.max_column + 1))]):
            if headers and first not in ("商品卡", "卖家直播", "卖家视频", "联盟营销", "Shopee 广告"):
                current_source = first
                row_data = {"来源": current_source, "日期": "汇总", "类型": "汇总"}
                for c in range(2, len(headers) + 1):
                    row_data[headers[c - 1]] = cell_val(ws, r, c)
                results.append(row_data)
            elif first in ("商品卡", "卖家直播", "卖家视频", "联盟营销", "Shopee 广告"):
                current_source = first

    df = pd.DataFrame(results)
    if df.empty:
        return df

    money_cols = ["销售 (BRL)", "每个订单的销售额"]
    pct_cols = ["销售占比", "点击率", "订单转化率", "Ads Impression", "Conversion", "ROAS"]
    int_cols = ["商品曝光量", "商品点击量", "订单数", "件数", "买家数",
                "不重复的商品曝光量", "不重复的商品点击量",
                "直播观看次数", "直播观看人数", "视频观看次数", "视频观看人数",
                "内容观看次数", "内容观看人数", "花费", "点击"]

    for col in money_cols:
        if col in df.columns:
            df[col] = df[col].apply(parse_br_number)
    for col in pct_cols:
        if col in df.columns:
            df[col] = df[col].apply(parse_pct)
    for col in int_cols:
        if col in df.columns:
            df[col] = df[col].apply(parse_int)

    if "日期" in df.columns:
        date_mask = df["日期"].str.match(r"^\d{2}/\d{2}/\d{4}$")
        df.loc[date_mask, "日期"] = pd.to_datetime(df.loc[date_mask, "日期"], format="%d/%m/%Y")

    return df.reset_index(drop=True)


def clean_product_distribution(ws) -> pd.DataFrame:
    results = []
    current_section = ""
    current_headers = []
    in_product_zone = False

    for r in range(1, ws.max_row + 1):
        first = cell_val(ws, r, 1)
        second = cell_val(ws, r, 2)

        if first in ("商品卡", "卖家直播", "卖家视频", "联盟营销") and second == "":
            current_section = first
            in_product_zone = False
            continue

        if first == "商品编号":
            current_headers = [cell_val(ws, r, c) for c in range(1, ws.max_column + 1)]
            in_product_zone = True
            continue

        if first in ("", "日期") and not (first == "" and in_product_zone):
            in_product_zone = False
            continue

        if in_product_zone and current_headers and first and first.isdigit():
            row_data = {"section": current_section}
            for c in range(1, len(current_headers) + 1):
                row_data[current_headers[c - 1]] = cell_val(ws, r, c)
            results.append(row_data)

    df = pd.DataFrame(results)
    if df.empty:
        return df

    money_cols = ["销售 (BRL)", "每个订单的销售额"]
    pct_cols = ["销售占比", "点击率", "订单转化率"]
    int_cols = ["商品曝光量", "商品点击量", "订单数", "件数", "买家数",
                "不重复的商品曝光量", "不重复的商品点击量"]

    for col in money_cols:
        if col in df.columns:
            df[col] = df[col].apply(parse_br_number)
    for col in pct_cols:
        if col in df.columns:
            df[col] = df[col].apply(parse_pct)
    for col in int_cols:
        if col in df.columns:
            df[col] = df[col].apply(parse_int)

    return df.reset_index(drop=True)


# ============================================================
# 工作表名称匹配
# ============================================================

SHEET_SPECS = [
    ("orders",       ["订单"], ["已付款", "流量", "来源", "商品"]),
    ("paid_orders",  ["订单", "已付款"], ["流量", "来源", "商品"]),
    ("traffic",      ["流量来源"], ["已付款"]),
    ("source_dist",  ["来源分布"], ["已付款"]),
    ("products",     ["商品分布"], ["已付款"]),
    ("paid_traffic", ["流量来源", "已付款"], []),
    ("paid_source",  ["来源分布", "已付款"], []),
    ("paid_products",["商品分布", "已付款"], []),
]


def match_sheets(sheetnames: list[str]) -> dict[str, str]:
    result = {}
    for key, required, excluded in SHEET_SPECS:
        candidates = sheetnames
        for keyword in required:
            candidates = [n for n in candidates if keyword in n]
        for keyword in excluded:
            candidates = [n for n in candidates if keyword not in n]
        if len(candidates) != 1:
            raise ValueError(
                f"未找到或匹配到多张「{key}」工作表（需含{required}、不含{excluded}），"
                f"实际工作表：{sheetnames}"
            )
        result[key] = candidates[0]
    return result
