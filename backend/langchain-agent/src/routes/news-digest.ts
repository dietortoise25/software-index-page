import { Router } from "express"
import { runNewsDigest, type StageEvent } from "../lib/news-digest-agent.js"
import { listRuns, getRun } from "../db/queries/news-digest-runs.js"

export const newsDigestRouter = Router()

function sse(res: import("express").Response, data: StageEvent) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

newsDigestRouter.post("/news-digest/run", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("X-Accel-Buffering", "no")

  try {
    const { goal, config } = req.body as { goal?: string; config?: Record<string, unknown> }
    await runNewsDigest("manual", (event) => {
      sse(res, event)
    }, goal, config as never)
  } catch (e) {
    sse(res, { status: "error", stage: "system", error: e instanceof Error ? e.message : String(e) })
  }

  res.end()
})

newsDigestRouter.get("/news-digest/runs", async (_req, res) => {
  try {
    const limit = Math.min(parseInt(String(_req.query.limit)) || 20, 100)
    const runs = await listRuns(limit)
    res.json({ ok: true, data: runs })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : "查询运行记录失败" })
  }
})

newsDigestRouter.get("/news-digest/runs/:id", async (req, res) => {
  try {
    const run = await getRun(req.params.id)
    if (!run) {
      res.status(404).json({ ok: false, error: "运行记录不存在" })
      return
    }
    res.json({ ok: true, data: run })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : "查询运行记录失败" })
  }
})
