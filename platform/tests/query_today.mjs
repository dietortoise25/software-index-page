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

const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
const todayEnd = new Date();
todayEnd.setHours(23, 59, 59, 999);

console.log(`查询日期: ${todayStart.toISOString().slice(0, 10)}`);
console.log("=".repeat(50));

// 1. 今日订单总数
const { count, error: countErr } = await supabase
  .from("orders")
  .select("*", { count: "exact", head: true })
  .gte("pay_time", todayStart.toISOString())
  .lte("pay_time", todayEnd.toISOString());

if (countErr) {
  console.error(`❌ 订单数查询失败: ${countErr.message}`);
} else {
  console.log(`今日付款订单数: ${count ?? 0}`);
}

// 2. 今日销售额
const { data: sumData, error: sumErr } = await supabase
  .from("orders")
  .select("total_amount, currency")
  .gte("pay_time", todayStart.toISOString())
  .lte("pay_time", todayEnd.toISOString());

if (sumErr) {
  console.error(`❌ 销售额查询失败: ${sumErr.message}`);
} else if (sumData.length === 0) {
  console.log("今日销售额: 0 (无付款订单)");
} else {
  const byCurrency = {};
  for (const o of sumData) {
    const c = o.currency || "UNKNOWN";
    byCurrency[c] = (byCurrency[c] || 0) + parseFloat(o.total_amount || 0);
  }
  console.log(`今日销售额 (按币种):`);
  for (const [currency, amount] of Object.entries(byCurrency)) {
    console.log(`  ${currency}: ${amount.toFixed(2)}`);
  }
}

// 3. 最近同步时间
const { data: syncData } = await supabase
  .from("sync_logs")
  .select("module, status, records_count, started_at")
  .order("started_at", { ascending: false })
  .limit(5);

console.log("\n最近同步记录:");
for (const s of syncData || []) {
  console.log(`  [${s.status}] ${s.module}: ${s.records_count}条 @ ${s.started_at}`);
}
