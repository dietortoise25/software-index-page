export type Platform = 'tiktok' | 'shopee';
export type Classification = '商品损坏' | '错发/缺件' | '描述不符' | '物流问题' | '买家改变主意' | '其他异常';
export type Responsibility = 'warehouse' | 'non-warehouse';

interface FieldMap { [key: string]: string }

const COMMON_MAP: FieldMap = {
  site: '站点',
  shop: '店铺',
  orderNo: '订单编号',
  returnNo: '退单编号',
  returnType: '退单类型',
  refundAmount: '退款申请金额',
  refundReason: '退款原因',
  refundEvidence: '退款证据',
  status: '最新状态',
  productName: '商品名称',
  sku: 'SKU',
  skuCode: 'SKU货号',
  orderAmount: '订单付款金额',
  logisticsCompany: '订单物流公司',
  logisticsNo: '订单物流单号',
  orderTime: '下单时间 (UTC+8)',
  returnTime: '退单时间 (UTC+8)',
  updateTime: '最后更新时间 (UTC+8)',
};

const TIKTOK_EXTRA: FieldMap = {
  returnLogisticsNo: '退货物流单号',
  remark: '备注',
};

const SHOPEE_EXTRA: FieldMap = {
  refundDesc: '退款描述',
  returnLogisticsNo: '逆向物流单号',
  returnLogistics: '逆向物流',
  remark: '备注',
  buyerNick: '买家昵称',
  productCode: '主商品货号',
  adjustDetail: '订单调整金额明细',
  adjustTotal: '订单调整金额总额',
  income: '订单收入',
  forwardLogistics: '正向物流',
};

// 退款原因降维映射: 原始原因 → 统一分类
const TIKTOK_CLASSIFY: Record<string, Classification> = {
  '商品到达时已损坏': '商品损坏',
  '包裹到达时已损坏': '商品损坏',
  '商品有缺陷': '商品损坏',
  '商品错发': '错发/缺件',
  '收到包裹但物品缺失': '错发/缺件',
  '商品与描述不符': '描述不符',
  '面料、材质或款式不符合预期': '描述不符',
  '未收到包裹': '物流问题',
  '商品未准时送达': '物流问题',
  '交货延迟': '物流问题',
  '不需要了': '买家改变主意',
  '商品不合适': '买家改变主意',
};

const SHOPEE_CLASSIFY: Record<string, Classification> = {
  '破损-其他': '商品损坏',
  '外包装损坏': '商品损坏',
  '我收到的商品功能无法使用': '商品损坏',
  '我收到了错误的商品': '错发/缺件',
  '我收到不完整商品（数量缺少或商品缺件）': '错发/缺件',
  '商品内容漏了': '错发/缺件',
  '我没有收到': '物流问题',
  '我改变主意了': '买家改变主意',
  '商品不合适': '买家改变主意',
  '可疑包裹': '其他异常',
};

const CLASSIFICATION_RESPONSIBILITY: Record<Classification, Responsibility> = {
  '商品损坏': 'warehouse',
  '错发/缺件': 'warehouse',
  '描述不符': 'non-warehouse',
  '物流问题': 'non-warehouse',
  '买家改变主意': 'non-warehouse',
  '其他异常': 'non-warehouse',
};

export function classifyReason(rawReason: string, platform: Platform): Classification {
  const map = platform === 'tiktok' ? TIKTOK_CLASSIFY : SHOPEE_CLASSIFY;
  return map[rawReason] ?? '其他异常';
}

export function assignResponsibility(category: Classification): Responsibility {
  return CLASSIFICATION_RESPONSIBILITY[category];
}

export interface UnifiedRow {
  platform: Platform;
  site: string;
  shop: string;
  orderNo: string;
  returnNo: string;
  returnType: string;
  refundAmount: string;
  refundReason: string;
  refundEvidence: string;
  status: string;
  productName: string;
  sku: string;
  skuCode: string;
  orderAmount: string;
  logisticsCompany: string;
  logisticsNo: string;
  orderTime: string;
  returnTime: string;
  updateTime: string;
  returnLogisticsNo?: string;
  remark?: string;
  refundDesc?: string;
  returnLogistics?: string;
  buyerNick?: string;
  productCode?: string;
  adjustDetail?: string;
  adjustTotal?: string;
  income?: string;
  forwardLogistics?: string;
  classification?: Classification;
  responsibility?: Responsibility;
}

type RawRow = Record<string, string>;

export function normalizeRow(row: RawRow, platform: Platform): UnifiedRow {
  const extra = platform === 'tiktok' ? TIKTOK_EXTRA : SHOPEE_EXTRA;
  const result: Record<string, string> = { platform };

  for (const [key, cnField] of Object.entries(COMMON_MAP)) {
    result[key] = row[cnField] ?? '';
  }
  for (const [key, cnField] of Object.entries(extra)) {
    result[key] = row[cnField] ?? '';
  }

  const reason = result.refundReason;
  const classification = classifyReason(reason, platform);
  result.classification = classification;
  result.responsibility = assignResponsibility(classification);

  return result as unknown as UnifiedRow;
}

export function normalizeRows(rows: RawRow[], platform: Platform): UnifiedRow[] {
  return rows.map(row => normalizeRow(row, platform));
}

export interface Schema {
  common: { key: string; label: string }[];
  tiktokOnly: string[];
  shopeeOnly: string[];
}

export function getSchema(): Schema {
  return {
    common: Object.keys(COMMON_MAP).map(k => ({ key: k, label: COMMON_MAP[k] })),
    tiktokOnly: Object.keys(TIKTOK_EXTRA),
    shopeeOnly: Object.keys(SHOPEE_EXTRA),
  };
}
