/**
 * 飞书日历 API — 忙闲查询、可用时段计算
 */
import { getTenantToken, getUserOpenId } from "./feishu.js"

const CALENDAR_BASE = "https://open.feishu.cn/open-apis/calendar/v4"

interface FreeBusyItem {
  start_time: string
  end_time: string
  is_busy: boolean
}

export interface AvailabilitySlot {
  date: string
  dayOfWeek: string
  slots: Array<{
    start: string
    end: string
    totalMinutes: number
  }>
  isAvailable: boolean
}

const DAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

/** 查询用户忙闲时段 */
export async function queryFreeBusy(
  token: string,
  userId: string,
  timeMin: string,
  timeMax: string,
): Promise<FreeBusyItem[]> {
  const resp = await fetch(`${CALENDAR_BASE}/freebusy/list`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      time_min: timeMin,
      time_max: timeMax,
      user_id: userId,
      type: "open_id",
    }),
  })
  const data = (await resp.json()) as {
    code: number
    msg?: string
    data?: { items?: FreeBusyItem[] }
  }
  if (data.code !== 0) {
    throw new Error(`飞书日历 API 错误: ${data.msg || "未知错误"} (code=${data.code})`)
  }
  return data.data?.items || []
}

/** 计算工作日空闲时段（未来 days 天） */
export async function getAvailabilitySlots(
  token: string,
  userId: string,
  days = 14,
): Promise<AvailabilitySlot[]> {
  const now = new Date()
  const end = new Date(now)
  end.setDate(end.getDate() + days)

  const timeMin = now.toISOString()
  const timeMax = end.toISOString()

  const busyItems = await queryFreeBusy(token, userId, timeMin, timeMax)

  const result: AvailabilitySlot[] = []

  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    const dayOfWeek = d.getDay()

    // 跳过周末
    if (dayOfWeek === 0 || dayOfWeek === 6) continue

    const dateStr = d.toISOString().slice(0, 10)
    const businessSlots = [
      { start: "09:00", end: "12:00", totalMinutes: 180 },
      { start: "13:00", end: "18:00", totalMinutes: 300 },
    ]

    // 从 busyItems 中提取该日期的忙碌时段
    const dayBusy: Array<{ start: Date; end: Date }> = []
    for (const item of busyItems) {
      const itemStart = new Date(item.start_time)
      if (itemStart.toISOString().slice(0, 10) === dateStr && item.is_busy !== false) {
        dayBusy.push({
          start: new Date(item.start_time),
          end: new Date(item.end_time),
        })
      }
    }

    // 计算每个商务时段的有效空闲
    const availableSlots: AvailabilitySlot["slots"] = []
    for (const slot of businessSlots) {
      const [sh, sm] = slot.start.split(":").map(Number)
      const [eh, em] = slot.end.split(":").map(Number)
      const slotStart = new Date(d)
      slotStart.setHours(sh, sm, 0, 0)
      const slotEnd = new Date(d)
      slotEnd.setHours(eh, em, 0, 0)

      // 跳过已过去的时段
      if (slotEnd.getTime() < now.getTime()) continue

      // 减去忙碌重叠部分
      let freeStart = slotStart
      const subSlots: typeof availableSlots = []

      for (const busy of dayBusy) {
        if (busy.end.getTime() <= freeStart.getTime()) continue
        if (busy.start.getTime() >= slotEnd.getTime()) continue

        const busyStart = busy.start < freeStart ? freeStart : busy.start
        const busyEnd = busy.end > slotEnd ? slotEnd : busy.end

        if (busyStart.getTime() > freeStart.getTime()) {
          const mins = Math.round((busyStart.getTime() - freeStart.getTime()) / 60000)
          if (mins >= 30) {
            subSlots.push({
              start: `${String(freeStart.getHours()).padStart(2, "0")}:${String(freeStart.getMinutes()).padStart(2, "0")}`,
              end: `${String(busyStart.getHours()).padStart(2, "0")}:${String(busyStart.getMinutes()).padStart(2, "0")}`,
              totalMinutes: mins,
            })
          }
        }
        freeStart = busyEnd
      }

      // 剩余部分
      if (freeStart.getTime() < slotEnd.getTime()) {
        const mins = Math.round((slotEnd.getTime() - freeStart.getTime()) / 60000)
        if (mins >= 30) {
          subSlots.push({
            start: `${String(freeStart.getHours()).padStart(2, "0")}:${String(freeStart.getMinutes()).padStart(2, "0")}`,
            end: slot.end,
            totalMinutes: mins,
          })
        }
      }

      availableSlots.push(...subSlots)
    }

    result.push({
      date: dateStr,
      dayOfWeek: DAY_NAMES[dayOfWeek],
      slots: availableSlots,
      isAvailable: availableSlots.length > 0,
    })
  }

  return result
}

/** 便捷函数：自动获取 token 和 open_id，返回可用时段 */
export async function fetchMyAvailability(days = 14): Promise<{
  availability: AvailabilitySlot[]
  error?: string
}> {
  try {
    const token = await getTenantToken()
    const openId = await getUserOpenId(token)
    if (!openId) return { availability: [], error: "未找到用户 Alan，请检查飞书通讯录" }
    const availability = await getAvailabilitySlots(token, openId, days)
    return { availability }
  } catch (err) {
    return { availability: [], error: err instanceof Error ? err.message : "日历查询失败" }
  }
}

/** 在飞书日历中创建单个日程事件 */
export async function createCalendarEvent(
  token: string,
  calendarId: string,
  summary: string,
  description: string,
  date: string,
  startTime: string,
  endTime: string,
): Promise<void> {
  // 将 date + time 转为 Unix 时间戳
  const tz = "Asia/Shanghai"
  const startTs = String(Math.floor(new Date(`${date}T${startTime}:00+08:00`).getTime() / 1000))
  const endTs = String(Math.floor(new Date(`${date}T${endTime}:00+08:00`).getTime() / 1000))

  const resp = await fetch(`${CALENDAR_BASE}/calendars/${calendarId}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary,
      description,
      start_time: { timestamp: startTs, timezone: tz },
      end_time: { timestamp: endTs, timezone: tz },
    }),
  })
  const data = (await resp.json()) as { code: number; msg?: string }
  if (data.code !== 0) {
    throw new Error(`创建日历事件失败: ${data.msg || "未知错误"} (code=${data.code})`)
  }
}
