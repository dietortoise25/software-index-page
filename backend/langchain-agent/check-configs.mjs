// 只读：查 news_configs，确认有几条配置、cron 表达式是否重复
import "dotenv/config"
import { createClient } from "@supabase/supabase-js"

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
)

// news_configs 表结构：每行一条独立配置
const { data, error } = await sb.schema("agent")
  .from("news_configs").select("*").order("created_at", { ascending: true })

if (error) {
  console.error("查 news_configs 失败（可能是单配置 news_config 键值表）:", error.message)
} else {
  console.log(`\n=== news_configs 配置数: ${data.length} ===`)
  for (const row of data) {
    const c = row.config || {}
    console.log(`  name="${row.name}" id=${row.id}`)
    console.log(`    cron=${JSON.stringify(c.cron)}  enabled=${c.enabled}  mode=${c.mode}`)
  }
}
console.log("")
