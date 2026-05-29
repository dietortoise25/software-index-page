import { Router } from "express"
import { getNewsConfig, setAllNewsConfig } from "../db/queries/news-config.js"
import { startCron } from "../lib/cron-scheduler.js"

export const newsConfigRouter = Router()

newsConfigRouter.get("/news-config", async (_req, res) => {
  try {
    const config = await getNewsConfig()
    res.json({ ok: true, data: config })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : "读取配置失败" })
  }
})

newsConfigRouter.put("/news-config", async (req, res) => {
  try {
    await setAllNewsConfig(req.body)
    startCron()
    const config = await getNewsConfig()
    res.json({ ok: true, data: config })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[news-config] PUT error:", msg)
    res.status(500).json({ ok: false, error: msg || "保存配置失败" })
  }
})
