/**
 * 需求管理 API — CRUD + 审批 + 日历事件创建
 */
import { Router } from "express"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { generateObject } from "ai"
import { getTenantToken, getUserOpenId, sendFeishuMessage, sendFeishuCard } from "../lib/feishu.js"
import { buildRequirementsCard } from "../lib/feishu-card.js"
import { createCalendarEvent } from "../lib/feishu-calendar.js"
import { scheduleProposalSchema, SCHEDULE_SYSTEM_PROMPT } from "../lib/schedule-prompt.js"
import { fetchMyAvailability } from "../lib/feishu-calendar.js"
import {
  addRequirementAsync,
  readRequirements,
  getRequirement,
  updateRequirementAsync,
  removeRequirementAsync,
  removeRequirementsAsync,
} from "../lib/storage.js"
import type { StoredRequirement } from "../lib/storage.js"

const router = Router()

const REVIEW_PIN = process.env.REVIEW_PIN!

function checkPin(body: Record<string, unknown>): boolean {
  return String(body.pin || "") === REVIEW_PIN
}

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY || "",
  baseURL: process.env.DEEPSEEK_API_URL_OpenAI || "https://api.deepseek.com",
})

/** 提交新需求（公开） */
router.post("/", async (req, res) => {
  try {
    const { requirement, schedule, submitter } = req.body as {
      requirement?: Record<string, unknown>
      schedule?: Record<string, unknown>
      submitter?: string
    }

    if (!requirement) {
      res.status(400).json({ ok: false, error: "缺少 requirement" })
      return
    }

    const record: StoredRequirement = {
      id: `req_${Date.now()}`,
      status: "pending",
      requirement: requirement as StoredRequirement["requirement"],
      schedule: (schedule as StoredRequirement["schedule"]) || null,
      submitter: submitter || "匿名",
      submittedAt: new Date().toISOString(),
    }

    await addRequirementAsync(record)
    console.log(`[storage] 新需求: ${record.id} — ${record.requirement.title}`)

    // 发飞书通知给 Alan
    try {
      const token = await getTenantToken()
      const openId = await getUserOpenId(token)
      if (openId) {
        await sendFeishuMessage(
          token,
          openId,
          `📋 新需求待审查\n${submitter || "匿名"} 提交了需求：「${record.requirement.title}」\n优先级：${record.requirement.priority} | 类型：${record.requirement.type}\n🔗 前往审查：http://42.193.170.109/review`,
        )
      }
    } catch (e) {
      console.error("[notify] 新需求通知失败", e)
    }

    res.json({ ok: true, id: record.id })
  } catch (err) {
    console.error("[requirements] create error", err)
    res.status(500).json({ ok: false, error: "提交失败" })
  }
})

/** 列表所有需求（需 PIN，用 POST 避免 URL 泄露） */
router.post("/list", (req, res) => {
  if (!checkPin(req.body as Record<string, unknown>)) {
    res.status(403).json({ ok: false, error: "PIN 码错误" })
    return
  }
  const list = readRequirements()
  res.json({ ok: true, data: list })
})

/** 获取单个需求（需 PIN） */
router.post("/:id/detail", (req, res) => {
  if (!checkPin(req.body as Record<string, unknown>)) {
    res.status(403).json({ ok: false, error: "PIN 码错误" })
    return
  }
  const record = getRequirement(req.params.id)
  if (!record) {
    res.status(404).json({ ok: false, error: "需求不存在" })
    return
  }
  res.json({ ok: true, data: record })
})

/** 通过审批 — 原子性：先验证，再创建事件+发卡片，最后更新状态 */
router.post("/:id/approve", async (req, res) => {
  if (!checkPin(req.body as Record<string, unknown>)) {
    res.status(403).json({ ok: false, error: "PIN 码错误" })
    return
  }

  try {
    // 1. 验证前置条件
    const record = getRequirement(req.params.id)
    if (!record) {
      res.status(404).json({ ok: false, error: "需求不存在" })
      return
    }
    if (record.status !== "pending") {
      res.status(400).json({ ok: false, error: "该需求已被处理" })
      return
    }

    const token = await getTenantToken()
    const openId = await getUserOpenId(token)
    const errors: string[] = []

    // 2. 创建日历事件（非阻塞，失败不影响审批）
    const calendarId = process.env.FEISHU_CALENDAR_ID
    if (calendarId && record.schedule?.schedule) {
      for (const phase of record.schedule.schedule) {
        try {
          await createCalendarEvent(
            token,
            calendarId,
            `[${phase.phase}] ${record.requirement.title}`,
            `需求类型：${record.requirement.type}\n优先级：${record.requirement.priority}\n提交人：${record.submitter}\n阶段描述：${phase.description}`,
            phase.date,
            phase.startTime,
            phase.endTime,
          )
        } catch (err) {
          const msg = `创建日历事件失败 [${phase.phase}]: ${err instanceof Error ? err.message : String(err)}`
          console.error(`[calendar] ${msg}`)
          errors.push(msg)
        }
      }
    } else if (!calendarId) {
      console.warn("[approve] FEISHU_CALENDAR_ID 未设置，跳过日历事件创建")
    }

    // 3. 发送飞书卡片
    if (openId) {
      const card = buildRequirementsCard(record.requirement, record.schedule || undefined)
      const feishuResult = await sendFeishuCard(token, openId, card)
      if (feishuResult.code !== 0) {
        errors.push(`飞书卡片发送失败: ${feishuResult.msg}`)
      }
    }

    // 4. 更新状态
    await updateRequirementAsync(req.params.id, {
      status: "approved",
      reviewedAt: new Date().toISOString(),
    })

    console.log(`[approve] ${record.id} 已通过${errors.length > 0 ? ` (含 ${errors.length} 个非致命错误)` : ""}`)
    res.json({ ok: true, warnings: errors.length > 0 ? errors : undefined })
  } catch (err) {
    console.error("[approve error]", err)
    res.status(500).json({ ok: false, error: "审批失败" })
  }
})

/** 驳回需求 + 发送飞书通知 */
router.post("/:id/reject", async (req, res) => {
  if (!checkPin(req.body as Record<string, unknown>)) {
    res.status(403).json({ ok: false, error: "PIN 码错误" })
    return
  }

  const record = getRequirement(req.params.id)
  if (!record) {
    res.status(404).json({ ok: false, error: "需求不存在" })
    return
  }

  const { note } = req.body as { note?: string }

  await updateRequirementAsync(req.params.id, {
    status: "rejected",
    reviewedAt: new Date().toISOString(),
    reviewNote: note || "",
  })

  // 发送驳回通知给 Alan（记录）
  try {
    const token = await getTenantToken()
    const openId = await getUserOpenId(token)
    if (openId) {
      await sendFeishuMessage(
        token,
        openId,
        `↩️ 需求已驳回\n「${record.requirement.title}」已被驳回${note ? `，原因：${note}` : ""}\n提交人：${record.submitter}\n🔗 审查面板：http://42.193.170.109/review`,
      )
    }
  } catch (e) {
    console.error("[reject] 驳回通知失败", e)
  }

  console.log(`[reject] ${record.id} 已驳回`)
  res.json({ ok: true })
})

/** 重新生成排期 */
router.post("/:id/reschedule", async (req, res) => {
  if (!checkPin(req.body as Record<string, unknown>)) {
    res.status(403).json({ ok: false, error: "PIN 码错误" })
    return
  }

  const record = getRequirement(req.params.id)
  if (!record) {
    res.status(404).json({ ok: false, error: "需求不存在" })
    return
  }

  try {
    const { availability } = await fetchMyAvailability(7)
    const availSummary = availability
      .filter((a) => a.isAvailable)
      .slice(0, 10)
      .map((a) => {
        const slotStrs = a.slots.map((s) => `${s.start}-${s.end}(${s.totalMinutes}分钟)`)
        return `${a.date} ${a.dayOfWeek}: ${slotStrs.join("、")}`
      })
      .join("\n")

    const result = await generateObject({
      model: deepseek("deepseek-chat"),
      system: SCHEDULE_SYSTEM_PROMPT,
      prompt: `请为以下需求生成开发排期：\n\n## 需求\n${JSON.stringify(record.requirement, null, 2)}\n\n## 日历可用时段\n${availSummary || "暂无可用的空闲时段"}`,
      schema: scheduleProposalSchema,
      temperature: 0.3,
      maxOutputTokens: 2048,
    })

    const newSchedule = result.object as Record<string, unknown>
    await updateRequirementAsync(req.params.id, { schedule: newSchedule as StoredRequirement["schedule"] })

    res.json({ ok: true, data: newSchedule })
  } catch (err) {
    console.error("[reschedule error]", err)
    res.status(500).json({ ok: false, error: "重新排期失败" })
  }
})

/** 更新需求字段 */
router.post("/:id/update", async (req, res) => {
  if (!checkPin(req.body as Record<string, unknown>)) {
    res.status(403).json({ ok: false, error: "PIN 码错误" })
    return
  }

  const record = getRequirement(req.params.id)
  if (!record) {
    res.status(404).json({ ok: false, error: "需求不存在" })
    return
  }

  const { fields } = req.body as { fields?: Record<string, string> }
  if (!fields || Object.keys(fields).length === 0) {
    res.status(400).json({ ok: false, error: "缺少 fields" })
    return
  }

  const merged = { ...record.requirement, ...fields }
  await updateRequirementAsync(req.params.id, { requirement: merged as StoredRequirement["requirement"] })
  console.log(`[update] ${record.id} 字段已更新`)
  res.json({ ok: true, data: merged })
})

/** 删除需求 */
router.post("/:id/delete", async (req, res) => {
  if (!checkPin(req.body as Record<string, unknown>)) {
    res.status(403).json({ ok: false, error: "PIN 码错误" })
    return
  }

  const deleted = await removeRequirementAsync(req.params.id)
  if (!deleted) {
    res.status(404).json({ ok: false, error: "需求不存在" })
    return
  }
  console.log(`[delete] ${req.params.id} 已删除`)
  res.json({ ok: true })
})

/** 手动发送飞书卡片（不改变状态） */
router.post("/:id/send-card", async (req, res) => {
  if (!checkPin(req.body as Record<string, unknown>)) {
    res.status(403).json({ ok: false, error: "PIN 码错误" })
    return
  }

  const record = getRequirement(req.params.id)
  if (!record) {
    res.status(404).json({ ok: false, error: "需求不存在" })
    return
  }

  try {
    const token = await getTenantToken()
    const openId = await getUserOpenId(token)
    if (!openId) {
      res.status(500).json({ ok: false, error: "消息发送通道暂不可用" })
      return
    }
    const card = buildRequirementsCard(record.requirement, record.schedule || undefined)
    const result = await sendFeishuCard(token, openId, card)
    if (result.code === 0) {
      console.log(`[send-card] ${record.id} 卡片已发送`)
      res.json({ ok: true })
    } else {
      res.status(500).json({ ok: false, error: `发送失败: ${result.msg}` })
    }
  } catch (err) {
    console.error("[send-card error]", err)
    res.status(500).json({ ok: false, error: "发送飞书卡片失败" })
  }
})

/** 批量删除 */
router.post("/batch-delete", async (req, res) => {
  if (!checkPin(req.body as Record<string, unknown>)) {
    res.status(403).json({ ok: false, error: "PIN 码错误" })
    return
  }
  const { ids } = req.body as { ids?: string[] }
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ ok: false, error: "缺少 ids 数组" })
    return
  }
  const deleted = await removeRequirementsAsync(ids)
  console.log(`[batch-delete] 已删除 ${deleted} 条需求`)
  res.json({ ok: true, deleted })
})

export default router
