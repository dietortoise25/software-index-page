import { getSb } from "./pool.js"

export async function ensureTables(): Promise<void> {
  const sb = getSb()
  const { error } = await sb.schema("agent").from("news_config").select("key").limit(1)
  if (error) {
    console.error(`[agent] news_config 表检查失败: ${error.message}`)
  } else {
    console.log("[agent] 新闻汇集数据表已就绪")
  }
}
