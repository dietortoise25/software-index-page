import { QianyiSDK } from "../sdk/index.js";

const sdk = new QianyiSDK({
  baseUrl: "https://asia.qianyierp.com",
  appId: "1778643156040-2842",
  appSecret: "be5f48375151c04cbe8b7d922e97071c",
});

try {
  const r = await sdk.inventory.listV2({ page: 1, pageSize: 3 });
  console.log("type:", typeof r);
  console.log("isArray:", Array.isArray(r));
  console.log("keys:", Object.keys(r || {}));
  console.log("total:", r?.total);
  console.log("resultLen:", r?.result?.length);
  console.log("sample:", JSON.stringify(r).slice(0, 800));
} catch (e) {
  console.error("ERR:", e.code, e.message);
}
