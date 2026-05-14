import fs from 'node:fs';
import path from 'node:path';
import { classifyReason, assignResponsibility, normalizeRow, type UnifiedRow, type Classification, type Responsibility } from './normalize.js';
import { lookupStore, type StoreMapping } from './store-map.js';

const OUTPUT_DIR = path.resolve('output');

export interface ProcessedRow {
  // 飞书写入字段
  orderNo: string;
  returnNo: string;
  shop: string;
  standardShop: string;
  operator: string;
  classification: Classification;
  rawReason: string;
  responsibility: Responsibility;
  refundEvidence: string;
  // 原始数据
  original: UnifiedRow;
}

export interface MergeResult {
  warehouse: ProcessedRow[];
  nonWarehouse: ProcessedRow[];
  all: ProcessedRow[];
}

/**
 * 合并解析结果并降维分流
 */
export function mergeAndClassify(
  parsed: Record<string, { sheets: Record<string, Record<string, string>[]>; meta: { file: string } }>,
  storeMap: StoreMapping[],
): MergeResult {
  const warehouse: ProcessedRow[] = [];
  const nonWarehouse: ProcessedRow[] = [];

  for (const [platformKey, sheetData] of Object.entries(parsed)) {
    const platform = platformKey.toLowerCase().includes('tiktok') ? 'tiktok' as const : 'shopee' as const;
    for (const rows of Object.values(sheetData.sheets)) {
      for (const row of rows) {
        const reason = (row['退款原因'] || '').trim();
        const classification = classifyReason(reason, platform);
        const responsibility = assignResponsibility(classification);

        const rawShop = (row['店铺'] || '').trim();
        const { standardName, operator } = lookupStore(rawShop, platform, storeMap);

        const normalized = normalizeRow(row, platform)
        const processed: ProcessedRow = {
          orderNo: normalized.orderNo,
          returnNo: normalized.returnNo,
          shop: rawShop,
          standardShop: standardName,
          operator,
          classification,
          rawReason: reason,
          responsibility,
          refundEvidence: (row['退款证据'] || '').trim(),
          original: normalized,
        };

        if (responsibility === 'warehouse') {
          warehouse.push(processed);
        } else {
          nonWarehouse.push(processed);
        }
      }
    }
  }

  return { warehouse, nonWarehouse, all: [...warehouse, ...nonWarehouse] };
}

/**
 * 生成 CSV 字符串
 */
export function generateCsv(rows: ProcessedRow[]): string {
  const headers = [
    '平台', '订单编号', '退单编号', '原始店铺名', '标准店铺名', '运营者',
    '退单类型', '退款申请金额', '退款原因(原始)', '退款原因(分类)',
    '责任归属', '最新状态', '商品名称', 'SKU', 'SKU货号',
    '订单付款金额', '订单物流公司', '订单物流单号',
    '下单时间', '退单时间', '最后更新时间',
  ];

  const escape = (v: string | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];

  for (const r of rows) {
    const o = r.original;
    lines.push([
      escape(o.platform), escape(r.orderNo), escape(r.returnNo),
      escape(r.shop), escape(r.standardShop), escape(r.operator),
      escape(o.returnType), escape(o.refundAmount),
      escape(r.rawReason), escape(r.classification), escape(r.responsibility),
      escape(o.status), escape(o.productName), escape(o.sku), escape(o.skuCode),
      escape(o.orderAmount), escape(o.logisticsCompany), escape(o.logisticsNo),
      escape(o.orderTime), escape(o.returnTime), escape(o.updateTime),
    ].join(','));
  }

  return lines.join('\n');
}

/**
 * 保存 CSV 到 output/ 目录
 */
export function saveCsv(rows: ProcessedRow[], filename?: string): string {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filepath = path.join(OUTPUT_DIR, filename || `merged_${ts}.csv`);
  const csv = generateCsv(rows);
  fs.writeFileSync(filepath, csv, 'utf8');
  return filepath;
}
