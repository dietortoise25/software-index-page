import cron from "node-cron"
import net from "net"
import { listAllConfigs } from "../db/queries/news-configs.js"

function checkProxy(): Promise<string> {
  return new Promise((resolve) => {
    const proxyUrl = process.env.JINA_PROXY
    if (!proxyUrl) return resolve("not_configured")
    const match = proxyUrl.match(/socks5?:\/\/([\d.]+):(\d+)|([\d.]+):(\d+)/)
    const host = match?.[1] || match?.[3] || "127.0.0.1"
    const port = parseInt(match?.[2] || match?.[4] || "10808", 10)
    const sock = net.createConnection({ host, port, timeout: 3000 })
    sock.on("connect", () => { sock.destroy(); resolve("running") })
    sock.on("error", () => resolve("down"))
    sock.on("timeout", () => { sock.destroy(); resolve("down") })
  })
}

interface CronJob {
  task: cron.ScheduledTask
  name: string
  cron: string
}

const jobs = new Map<string, CronJob>()

interface HealthEntry {
  config_id: string
  name: string
  cron: string
  status: "active" | "missing" | "stale"
  reason?: string
}

export interface HealthResult {
  healthy: boolean
  db_configs_with_cron: number
  cron_jobs_in_memory: number
  details: HealthEntry[]
  api_keys: { tavily: string; jina: string }
}

async function runHealthCheck(): Promise<HealthResult> {
  const dbConfigs = await listAllConfigs()
  const dbMap = new Map(dbConfigs.filter(c => !!c.config.cron).map(c => [c.id, c]))
  const details: HealthEntry[] = []
  const memIds = new Set(jobs.keys())

  for (const [id, row] of dbMap) {
    const job = jobs.get(id)
    details.push({
      config_id: id,
      name: row.name,
      cron: row.config.cron,
      status: job ? "active" : "missing",
      reason: job ? undefined : "cron 解析失败或注册时发生异常",
    })
    memIds.delete(id)
  }

  // 在内存中但不在 DB 中的（残留）
  for (const id of memIds) {
    const job = jobs.get(id)!
    details.push({
      config_id: id,
      name: job.name,
      cron: job.cron,
      status: "stale",
      reason: "仅在内存中，DB 中已不存在",
    })
  }

  const healthy = details.every(d => d.status === "active")

  const api_keys = {
    tavily: process.env.TAVILY_API_KEY ? "configured" : "missing",
    jina: process.env.JINA_API_KEY ? "configured" : "missing",
    proxy: await checkProxy(),
  }

  return {
    healthy,
    db_configs_with_cron: dbMap.size,
    cron_jobs_in_memory: jobs.size,
    details,
    api_keys,
  }
}

export async function rebuildCronJobs() {
  for (const [, job] of jobs) {
    job.task.stop()
  }
  jobs.clear()

  const configs = await listAllConfigs()

  if (configs.length === 0) {
    console.log("[agent] 无新闻配置，未注册任何定时推送")
    const health = await runHealthCheck()
    if (!health.healthy) {
      for (const h of health.details) {
        console.warn(`[agent] cron 健康检查告警: "${h.name}" (${h.config_id}) status=${h.status} ${h.reason || ""}`)
      }
    }
    return
  }

  const { runNewsDigest } = await import("./news-digest-agent.js")

  for (const row of configs) {
    const { id, config, name } = row

    if (!config.cron) {
      console.log(`[agent] 跳过配置 "${name}" (${id})：未设置 cron 表达式`)
      continue
    }

    if (config.enabled === false) {
      console.log(`[agent] 跳过已禁用配置 "${name}" (${id})`)
      continue
    }

    try {
      const goal = config.mode === "ai" && config.goal?.trim()
        ? config.goal.trim()
        : undefined

      const task = cron.schedule(config.cron, async () => {
        console.log(`[news-digest] cron 触发: "${name}" (${id})`)
        await runNewsDigest("cron", (event) => {
          if (event.status === "error") console.error(`[news-digest] "${name}": ${event.stage}: ${event.error}`)
          else if (event.status === "done") console.log(`[news-digest] "${name}": 完成, 耗时 ${event.duration}s`)
        }, goal, config)
      })

      jobs.set(id, { task, name, cron: config.cron })
      console.log(`[agent] 新闻定时推送已注册: "${name}" → ${config.cron}`)
    } catch (e) {
      console.error(`[agent] 注册定时任务失败 "${name}" (${id}):`, e)
    }
  }

  // 重建后立即 self-check
  const health = await runHealthCheck()
  if (health.healthy) {
    console.log(`[agent] cron 健康检查通过: ${health.cron_jobs_in_memory}/${health.db_configs_with_cron} 个任务一致`)
  } else {
    const bad = health.details.filter(d => d.status !== "active")
    for (const h of bad) {
      console.warn(`[agent] cron 健康检查告警: "${h.name}" (${h.config_id}) status=${h.status} ${h.reason || ""}`)
    }
  }
}

export async function getHealthStatus(): Promise<HealthResult> {
  return runHealthCheck()
}

export function getJobsStatus(): HealthResult["details"] {
  const result: HealthEntry[] = []
  for (const [id, job] of jobs) {
    result.push({ config_id: id, name: job.name, cron: job.cron, status: "active" })
  }
  return result
}
