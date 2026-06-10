import { describe, it, expect } from "vitest"
import { isRunStale, STALE_RUN_MS } from "../src/db/queries/news-digest-runs.js"

describe("isRunStale — 僵尸 running 记录判定", () => {
  const now = Date.parse("2026-06-09T12:00:00Z")

  it("刚启动几秒的 running 不算僵尸", () => {
    const startedAt = new Date(now - 5_000).toISOString()
    expect(isRunStale(startedAt, now)).toBe(false)
  })

  it("正常流水线耗时（约 3 分钟）内不算僵尸", () => {
    const startedAt = new Date(now - 3 * 60_000).toISOString()
    expect(isRunStale(startedAt, now)).toBe(false)
  })

  it("超过阈值（STALE_RUN_MS）的 running 判为僵尸", () => {
    const startedAt = new Date(now - STALE_RUN_MS - 1).toISOString()
    expect(isRunStale(startedAt, now)).toBe(true)
  })

  it("挂了 7 天的 running（真实事故场景）判为僵尸", () => {
    const startedAt = new Date(now - 7 * 24 * 60 * 60_000).toISOString()
    expect(isRunStale(startedAt, now)).toBe(true)
  })

  it("恰好等于阈值边界不算僵尸（用 > 而非 >=，避免边界误杀）", () => {
    const startedAt = new Date(now - STALE_RUN_MS).toISOString()
    expect(isRunStale(startedAt, now)).toBe(false)
  })
})
