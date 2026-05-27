/**
 * POST /api/calendar/propose-schedule — AI 排期生成
 * POST /api/calendar/availability    — 查询空闲时段（不含 AI）
 */
import { Router } from "express"
import { generateObject } from "ai"
import { fetchMyAvailability } from "../lib/feishu-calendar.js"
import { scheduleProposalSchema, SCHEDULE_SYSTEM_PROMPT } from "../lib/schedule-prompt.js"
import { deepseek, DEEPSEEK_MODEL } from "../lib/ai-config.js"

const router = Router()

/** AI 排期生成 */
router.post("/propose-schedule", async (req, res) => {
  try {
    const { requirement } = req.body as {
      requirement?: Record<string, unknown>
    }

    if (!requirement) {
      res.status(400).json({ ok: false, error: "缺少 requirement 参数" })
      return
    }

    // 查询日历空闲
    const { availability, error: calError } = await fetchMyAvailability(7)

    if (calError) {
      res.status(500).json({ ok: false, error: calError })
      return
    }

    // 格式化可用时段为中文摘要
    const availSummary = availability
      .filter((a) => a.isAvailable)
      .slice(0, 10)
      .map((a) => {
        const slotStrs = a.slots.map((s) => `${s.start}-${s.end}(${s.totalMinutes}分钟)`)
        return `${a.date} ${a.dayOfWeek}: ${slotStrs.join("、")}`
      })
      .join("\n")

    const requirementJson = JSON.stringify(requirement, null, 2)

    const prompt = `请根据以下信息生成开发排期：

## 需求文档
${requirementJson}

## 日历可用时段（未来14天的工作日）
${availSummary || "暂无可用的空闲时段"}`

    const result = await generateObject({
      model: deepseek(DEEPSEEK_MODEL),
      system: SCHEDULE_SYSTEM_PROMPT,
      prompt,
      schema: scheduleProposalSchema,
      temperature: 0.3,
      maxOutputTokens: 2048,
    })

    res.json({ ok: true, data: result.object })
  } catch (err) {
    console.error("[schedule error]", err)
    res.status(500).json({ ok: false, error: "排期生成失败，请重试" })
  }
})

/** 查询空闲时段（不含 AI，供前端快速刷新） */
router.post("/availability", async (_req, res) => {
  try {
    const { availability, error } = await fetchMyAvailability(14)
    if (error) {
      res.status(500).json({ ok: false, error })
      return
    }
    res.json({ ok: true, data: availability })
  } catch (err) {
    console.error("[availability error]", err)
    res.status(500).json({ ok: false, error: "日历查询失败" })
  }
})

export default router
