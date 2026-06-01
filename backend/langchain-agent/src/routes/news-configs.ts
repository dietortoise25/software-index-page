import { Router } from "express"
import { requireAuth } from "../auth/middleware.js"
import { listConfigs, createConfig, updateConfig, deleteConfig } from "../db/queries/news-configs.js"
import { rebuildCronJobs, getHealthStatus, getJobsStatus } from "../lib/cron-scheduler.js"

export const newsConfigsRouter = Router()

newsConfigsRouter.get("/news-configs", requireAuth, async (req, res) => {
  try {
    const configs = await listConfigs(req.user!.id)
    res.json({ ok: true, data: configs })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : "查询配置失败" })
  }
})

newsConfigsRouter.post("/news-configs", requireAuth, async (req, res) => {
  try {
    const { name, config } = req.body as { name?: string; config?: unknown }
    if (!name?.trim()) {
      res.status(400).json({ ok: false, error: "配置名称不能为空" })
      return
    }
    const row = await createConfig(req.user!.id, name.trim(), config as never)
    res.status(201).json({ ok: true, data: row })
    rebuildCronJobs().catch(err => console.error("[news-configs] POST 后重建定时任务失败:", err))
  } catch (e) {
    const msg = e instanceof Error ? e.message : "创建失败"
    const code = msg.includes("最多") ? 400 : 500
    res.status(code).json({ ok: false, error: msg })
  }
})

newsConfigsRouter.put("/news-configs/:id", requireAuth, async (req, res) => {
  try {
    const { name, config } = req.body as { name?: string; config?: unknown }
    const row = await updateConfig(req.params.id!, req.user!.id, {
      name, config: config as never,
    })
    res.json({ ok: true, data: row })
    rebuildCronJobs().catch(err => console.error("[news-configs] PUT 后重建定时任务失败:", err))
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : "更新失败" })
  }
})

newsConfigsRouter.delete("/news-configs/:id", requireAuth, async (req, res) => {
  try {
    await deleteConfig(req.params.id!, req.user!.id)
    res.json({ ok: true, data: null })
    rebuildCronJobs().catch(err => console.error("[news-configs] DELETE 后重建定时任务失败:", err))
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : "删除失败" })
  }
})

newsConfigsRouter.get("/news-cron-status", async (_req, res) => {
  try {
    const health = await getHealthStatus()
    const jobs = getJobsStatus()
    res.json({ ok: true, data: { healthy: health.healthy, active_jobs: jobs, job_count: jobs.length, health } })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : "查询 cron 状态失败" })
  }
})
