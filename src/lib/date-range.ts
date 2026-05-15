export function getChinaDateRange(daysAgo: number): { start: string; end: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" })
  const now = new Date()
  now.setDate(now.getDate() - daysAgo)
  const dateStr = fmt.format(now)
  return { start: `${dateStr}T00:00:00+08:00`, end: `${dateStr}T23:59:59+08:00` }
}

export function getMonthRange(offset: number): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + offset
  const target = new Date(Date.UTC(y, m, 1))
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const mm = String(target.getUTCMonth() + 1).padStart(2, "0")
  return {
    start: `${target.getUTCFullYear()}-${mm}-01T00:00:00+08:00`,
    end: `${target.getUTCFullYear()}-${mm}-${lastDay}T23:59:59+08:00`,
  }
}

export function monthKey(offset = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() - offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
