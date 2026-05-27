"""Shopee Excel 数据分析 — 编排层，组合 ETL + Metrics"""
import logging
import openpyxl

from extractors.shopee_store import (
    parse_br_number, parse_pct, parse_int,
    cell_val, is_empty_row,
    clean_orders_daily, clean_orders_summary,
    clean_traffic_source, clean_source_distribution, clean_product_distribution,
    SHEET_SPECS, match_sheets,
)
from metrics.store_metrics import (
    _nan_to_none, _df_to_records,
    compute_orders_data, compute_traffic_data, compute_product_data, compute_user_data,
)

logger = logging.getLogger(__name__)


def _get_date_range(orders_df):
    if orders_df is not None and not orders_df.empty and "日期" in orders_df.columns:
        dates = orders_df["日期"]
        return {
            "start": dates.min().strftime("%Y-%m-%d"),
            "end": dates.max().strftime("%Y-%m-%d"),
        }
    return {"start": None, "end": None}


def analyze_excel(file_source):
    wb = openpyxl.load_workbook(file_source, data_only=True)
    sheets = match_sheets(wb.sheetnames)
    logger.info(f"工作表匹配成功: {sheets}")

    orders_df = clean_orders_daily(wb[sheets["orders"]])
    paid_orders_df = clean_orders_daily(wb[sheets["paid_orders"]])
    traffic_df = clean_traffic_source(wb[sheets["traffic"]])
    source_dist_df = clean_source_distribution(wb[sheets["source_dist"]])
    products_df = clean_product_distribution(wb[sheets["products"]])
    paid_traffic_df = clean_traffic_source(wb[sheets["paid_traffic"]])
    paid_source_dist_df = clean_source_distribution(wb[sheets["paid_source"]])
    paid_products_df = clean_product_distribution(wb[sheets["paid_products"]])

    wb.close()

    return {
        "date_range": _get_date_range(orders_df),
        "sheet_names": {k: v for k, v in sheets.items()},
        "orders": compute_orders_data(orders_df),
        "paid_orders": compute_orders_data(paid_orders_df),
        "traffic": compute_traffic_data(traffic_df, source_dist_df),
        "paid_traffic": compute_traffic_data(paid_traffic_df, paid_source_dist_df),
        "products": compute_product_data(products_df),
        "paid_products": compute_product_data(paid_products_df),
        "users": compute_user_data(orders_df),
        "paid_users": compute_user_data(paid_orders_df),
    }
