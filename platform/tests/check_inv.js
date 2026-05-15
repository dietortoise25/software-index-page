import { QianyiSDK } from "../sdk/index.js";

const sdk = new QianyiSDK({
  baseUrl: "https://asia.qianyierp.com",
  appId: "1778643156040-2842",
  appSecret: "be5f48375151c04cbe8b7d922e97071c",
});

// 1. 先查仓库列表获取 warehouse id
console.log("获取仓库列表...");
const warehouses = await sdk.warehouse.list({ page: 1, pageSize: 10 });
console.log("仓库返回:", JSON.stringify(warehouses).slice(0, 500));

// 2. 带仓库参数查库存
if (warehouses?.result?.length > 0) {
  const wid = warehouses.result[0].id;
  console.log("\n使用仓库 ID:", wid);
  const r = await sdk.inventory.listV2({ page: 1, pageSize: 5, warehouse: wid });
  console.log("库存返回:", JSON.stringify(r).slice(0, 600));
}
