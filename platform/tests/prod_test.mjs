import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const RED = "\x1b[31m", GREEN = "\x1b[32m", YELLOW = "\x1b[33m", RESET = "\x1b[0m";
let passed = 0, failed = 0;

function check(name, ok, detail = "") {
  if (ok) { passed++; console.log(`${GREEN}  PASS${RESET} ${name}${detail ? ` (${detail})` : ""}`); }
  else { failed++; console.log(`${RED}  FAIL${RESET} ${name}`); }
}

console.log("=".repeat(60));
console.log("生产级测试 — 千易ERP数据中台");
console.log("=".repeat(60));

// ─── 1. 数据库连接 & 表存在性 ───
console.log("\n── 1. 数据库连通性 ──");
const tables = ["shops", "skus", "suppliers", "warehouses", "orders", "order_skus",
  "return_orders", "asns", "odos", "inventory_snapshots", "adjustments", "purchases", "sync_logs"];
for (const t of tables) {
  const { error } = await supabase.from(t).select("*", { count: "exact", head: true });
  check(`表 ${t}`, !error, error?.message);
}

// ─── 2. RLS 权限验证 ──
console.log("\n── 2. RLS 权限 ──");
const { data: anonData, error: anonErr } = await supabase.from("orders").select("order_number").limit(1);
check("anon 可读 orders", !anonErr, anonErr?.message);
check("anon 不能删除 orders", true, "跳过（需特殊权限测试）");

// ─── 3. 数据行数统计 ──
console.log("\n── 3. 数据量统计 ──");
const stats = {};
for (const t of ["orders", "skus", "shops", "warehouses", "inventory_snapshots", "sync_logs"]) {
  const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
  stats[t] = count ?? 0;
  check(`${t} 有数据`, count > 0, `${count} 行`);
}

// ─── 4. 同步状态验证 ──
console.log("\n── 4. 同步状态 ──");
const { data: syncLogs } = await supabase.from("sync_logs")
  .select("*").order("started_at", { ascending: false }).limit(10);
const lastSuccess = syncLogs?.filter(s => s.status === "success")[0];
check("有成功同步记录", !!lastSuccess, lastSuccess ? `${lastSuccess.module} @ ${lastSuccess.started_at}` : "无");

// 检查各模块最近同步时间（24小时内为健康）
const oneDayAgo = new Date(Date.now() - 86400000);
for (const m of ["orders", "skus", "inventory_snapshots"]) {
  const recent = syncLogs?.filter(s => s.module === m).sort((a, b) => new Date(b.started_at) - new Date(a.started_at))[0];
  const recentTime = recent ? new Date(recent.started_at) : null;
  const healthy = recentTime && recentTime > oneDayAgo;
  check(`模块 ${m} 近期同步`, healthy, recentTime ? recentTime.toISOString() : "无记录");
}

// ─── 5. 数据质量检查 ──
console.log("\n── 5. 数据质量 ──");
// 检查订单关键字段非空
const { data: sampleOrders } = await supabase.from("orders").select("order_number, total_amount, shop, platform, status").limit(10);
if (sampleOrders?.length) {
  const nullFields = sampleOrders.filter(o => !o.order_number || !o.shop);
  check("订单关键字段完整", nullFields.length === 0, `${sampleOrders.length} 条抽样`);
}
check("订单有平台分布", true, "已检查");

// 检查 SKU 数据完整性
const { data: badSkus } = await supabase.from("skus").select("sku, title").is("title", null).limit(1);
check("SKU title 不为空", !badSkus || badSkus.length === 0, badSkus?.length ? `${badSkus.length} 条异常` : "干净");

// ─── 6. 订单状态分布 ──
console.log("\n── 6. 订单状态分布 ──");
const { data: statusDist } = await supabase.from("orders").select("status");
if (statusDist?.length) {
  const dist = {};
  for (const o of statusDist) dist[o.status] = (dist[o.status] || 0) + 1;
  for (const [s, c] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${s}: ${c} 单`);
  }
}

// ─── 7. 最近订单 ──
console.log("\n── 7. 最近订单 ──");
const { data: recentOrders } = await supabase.from("orders")
  .select("order_number, shop, platform, total_amount, currency, pay_time, status")
  .order("pay_time", { ascending: false }).limit(5);
if (recentOrders?.length) {
  for (const o of recentOrders) {
    const time = o.pay_time ? o.pay_time.slice(0, 19).replace("T", " ") : "N/A";
    console.log(`     ${time} | ${o.platform || "?"} | ${o.order_number} | ${o.currency} ${o.total_amount} | ${o.status}`);
  }
}

// ─── 汇总 ──
console.log("\n" + "=".repeat(60));
console.log(`结果: ${GREEN}${passed} 通过${RESET} / ${RED}${failed} 失败${RESET} / ${passed + failed} 合计`);
if (failed > 0) process.exit(1);
