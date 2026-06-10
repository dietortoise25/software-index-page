// 一次性只读诊断：查 news_digest_runs 当前状态，重点找僵尸 running 记录
import "dotenv/config"
import { createClient } from "@supabase/supabase-js"

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
)

const { data: running, error: e1 } = await sb.schema("agent")
  .from("news_digest_runs").select("*").eq("status", "running")
  .order("started_at", { ascending: false })

if (e1) { console.error("查询 running 失败:", e1.message); process.exit(1) }

console.log(`\n=== status='running' 的记录数: ${running.length} ===`)
const now = Date.now()
for (const r of running) {
  const ageMin = ((now - new Date(r.started_at).getTime()) / 60000).toFixed(1)
  console.log(`  id=${r.id}`)
  console.log(`    trigger=${r.trigger_type}  started_at=${r.started_at}  已运行=${ageMin}分钟  finished_at=${r.finished_at ?? "null"}`)
}

const { data: recent } = await sb.schema("agent")
  .from("news_digest_runs").select("id,status,trigger_type,started_at,finished_at,error")
  .order("started_at", { ascending: false }).limit(10)

console.log(`\n=== 最近 10 条运行记录 ===`)
for (const r of recent ?? []) {
  console.log(`  ${r.started_at}  [${r.status}] ${r.trigger_type}  finished=${r.finished_at ?? "null"}  ${r.error ? "err=" + r.error.slice(0, 60) : ""}`)
}
console.log("")
