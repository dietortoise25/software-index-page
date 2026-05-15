import { QianyiSDK } from "../sdk/index.js";

const sdk = new QianyiSDK({
  baseUrl: "https://asia.qianyierp.com",
  appId: "1778643156040-2842",
  appSecret: "be5f48375151c04cbe8b7d922e97071c",
});

const tests = [
  { name: "店铺", fn: () => sdk.shop.list({ page: 1, pageSize: 3 }) },
  { name: "商品", fn: () => sdk.sku.list({ page: 1, pageSize: 3 }) },
  { name: "供应商", fn: () => sdk.supplier.list({ page: 1, pageSize: 3 }) },
  { name: "仓库", fn: () => sdk.warehouse.list({ page: 1, pageSize: 3 }) },
  { name: "入库单", fn: () => sdk.asn.list({ page: 1, pageSize: 3 }) },
  { name: "出库单", fn: () => sdk.odo.list({ page: 1, pageSize: 3 }) },
  { name: "调整单", fn: () => sdk.adjustment.list({ page: 1, pageSize: 3 }) },
  { name: "采购单", fn: () => sdk.purchase.list({ page: 1, pageSize: 3 }) },
  { name: "退货单", fn: () => sdk.returnOrder.list({ page: 1, pageSize: 3 }) },
  { name: "自定义栏位", fn: () => sdk.customField.query({ table: "SYS_ITEM", page: 1, pageSize: 3 }) },
];

for (const { name, fn } of tests) {
  try {
    const r = await fn();
    const count = r?.total ?? (Array.isArray(r?.result) ? r.result.length : "?");
    const state = r?.state ?? "?";
    console.log(`  PASS  ${name}: total=${count}, state=${state}`);
  } catch (e) {
    console.log(`  FAIL  ${name}: ${e.code} - ${e.message}`);
  }
}
