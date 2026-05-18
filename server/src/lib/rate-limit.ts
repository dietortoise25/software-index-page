/**
 * 简易内存限流器 — 基于时间窗口 + 计数器
 */
const store = new Map<string, { count: number; resetAt: number }>()

/** 定期清理过期条目，防止内存泄漏 */
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 5 * 60_000).unref()

/** 检查是否超过限制。windowMs 内最多 maxRequests 次 */
export function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }

  entry.count++
  return entry.count > maxRequests
}
