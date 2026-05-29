import cron from "node-cron"
import { getNewsConfig } from "../db/queries/news-config.js"

let cronJob: ReturnType<typeof cron.schedule> | null = null

export async function startCron() {
  const { runNewsDigest } = await import("./news-digest-agent.js")
  const config = await getNewsConfig()

  if (cronJob) cronJob.stop()

  cronJob = cron.schedule(config.cron, () => {
    console.log("[news-digest] cron 触发")
    runNewsDigest("cron", (event) => {
      if (event.status === "error") console.error(`[news-digest] ${event.stage}: ${event.error}`)
      else if (event.status === "done") console.log(`[news-digest] 完成, 耗时 ${event.duration}s`)
      else console.log(`[news-digest] ${event.status}`)
    })
  })
  console.log(`[agent] 新闻定时推送已注册: ${config.cron}`)
}
