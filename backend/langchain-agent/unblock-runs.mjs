// 解锁：把 2 条僵尸 running 记录标记为 failed（按 id 精确定位，保留记录不删除）
// 安全保护：只更新 status='running' 且 finished_at IS NULL 且运行超过 60 分钟的记录
import "dotenv/config"
import { createClient } from "@supabase/supabase-js"

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
)

const STALE_MIN = 60
const cutoff = new Date(Date.now() - STALE_MIN * 60000).toISOString()

const { data: stale, error: e0 } = await sb.schema("agent")
  .from("news_digest_runs").select("id,started_at")
  .eq("status", "running").is("finished_at", null).lt("started_at", cutoff)

if (e0) { console.error("查询失败:", e0.message); process.exit(1) }
console.log(`找到 ${stale.length} 条超过 ${STALE_MIN} 分钟的僵尸 running 记录`)

for (const r of stale) {
  const { error } = await sb.schema("agent").from("news_digest_runs")
    .update({ status: "failed", finished_at: new Date().toISOString(),
      error: "僵尸记录清理：进程重启/并发导致永久 running，手动解除阻塞" })
    .eq("id", r.id).eq("status", "running")
  console.log(error ? `  ✗ ${r.id}: ${error.message}` : `  ✓ ${r.id} (started ${r.started_at}) → failed`)
}

const { data: still } = await sb.schema("agent")
  .from("news_digest_runs").select("id").eq("status", "running")
console.log(`\n解锁后剩余 running 记录数: ${still?.length ?? "?"}`)
