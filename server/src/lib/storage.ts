/**
 * 轻量 JSON 文件存储 — 需求数据持久化
 * - 基于 Promise 链的写入互斥锁
 * - 原子写入（tmp + rename）
 * - 3级轮转备份
 * - 读取失败自动从备份恢复
 */
import fs from "node:fs"
import path from "node:path"
import type { Requirement } from "../schemas/requirement.js"
import type { ScheduleProposal } from "./schedule-prompt.js"

const DATA_DIR = path.resolve(process.cwd(), "data")
const FILE = path.join(DATA_DIR, "requirements.json")
const TMP_FILE = path.join(DATA_DIR, "requirements.tmp.json")
const BACKUP_PATTERN = (n: number) => path.join(DATA_DIR, `requirements.backup.${n}.json`)
const MAX_BACKUPS = 3

/** 写入互斥锁 — 防止并发写入覆盖 */
let writeLock: Promise<void> = Promise.resolve()

function withLock<T>(fn: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    writeLock = writeLock
      .then(() => fn())
      .then(resolve, reject)
      .catch(() => { /* 吞噬链上错误，防止 writeLock 永久断裂 */ })
  })
}

export interface StoredRequirement {
  id: string
  status: "pending" | "approved" | "rejected"
  requirement: Requirement
  schedule?: ScheduleProposal | null
  submitter: string
  submittedAt: string
  reviewedAt?: string | null
  reviewNote?: string
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

/** 轮转备份：将 requirements.json 复制为 .backup.1，依次后移 */
function rotateBackups() {
  if (!fs.existsSync(FILE)) return
  for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
    const src = i === 1 ? FILE : BACKUP_PATTERN(i - 1)
    const dst = BACKUP_PATTERN(i)
    if (fs.existsSync(src)) {
      try { fs.copyFileSync(src, dst) } catch { /* 备份失败不阻塞 */ }
    }
  }
}

/** 原子写入：先写临时文件，再 rename */
function atomicWrite(data: string) {
  fs.writeFileSync(TMP_FILE, data, "utf-8")
  fs.renameSync(TMP_FILE, FILE)
}

function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8")
  } catch {
    return null
  }
}

function parseRequirements(raw: string): StoredRequirement[] {
  return JSON.parse(raw) as StoredRequirement[]
}

export function readRequirements(): StoredRequirement[] {
  ensureDir()
  const raw = readFileSafe(FILE)
  if (raw) {
    try {
      return parseRequirements(raw)
    } catch (err) {
      console.error("[storage] requirements.json 解析失败，尝试从备份恢复:", (err as Error).message)
    }
  }

  // 尝试从最新备份恢复
  for (let i = 1; i <= MAX_BACKUPS; i++) {
    const backupRaw = readFileSafe(BACKUP_PATTERN(i))
    if (backupRaw) {
      try {
        const data = parseRequirements(backupRaw)
        console.log(`[storage] 从备份 ${i} 恢复成功，共 ${data.length} 条记录`)
        atomicWrite(JSON.stringify(data, null, 2))
        return data
      } catch {
        // 继续尝试下一个备份
      }
    }
  }

  console.warn("[storage] 所有备份均不可用，返回空数组")
  return []
}

function saveRequirements(list: StoredRequirement[]): void {
  ensureDir()
  rotateBackups()
  atomicWrite(JSON.stringify(list, null, 2))
}

// === 公开 API（全部通过互斥锁）===

export async function saveRequirementsAsync(list: StoredRequirement[]): Promise<void> {
  await withLock(() => saveRequirements(list))
}

export function getRequirement(id: string): StoredRequirement | undefined {
  return readRequirements().find((r) => r.id === id)
}

export async function updateRequirementAsync(id: string, patch: Partial<StoredRequirement>): Promise<StoredRequirement | null> {
  return withLock(() => {
    const list = readRequirements()
    const idx = list.findIndex((r) => r.id === id)
    if (idx === -1) return null
    list[idx] = { ...list[idx], ...patch }
    saveRequirements(list)
    return list[idx]
  })
}

export async function addRequirementAsync(r: StoredRequirement): Promise<void> {
  await withLock(() => {
    const list = readRequirements()
    list.push(r)
    saveRequirements(list)
  })
}

/** 删除需求 */
export async function removeRequirementAsync(id: string): Promise<boolean> {
  return withLock(() => {
    const list = readRequirements()
    const idx = list.findIndex((r) => r.id === id)
    if (idx === -1) return false
    list.splice(idx, 1)
    saveRequirements(list)
    return true
  })
}

/** 批量删除 */
export async function removeRequirementsAsync(ids: string[]): Promise<number> {
  return withLock(() => {
    const list = readRequirements()
    const before = list.length
    const kept = list.filter((r) => !ids.includes(r.id))
    saveRequirements(kept)
    return before - kept.length
  })
}

// 同步版本（仅用于初始化等单线程场景，不经过锁，无备份）
export function updateRequirement(id: string, patch: Partial<StoredRequirement>): StoredRequirement | null {
  const list = readRequirements()
  const idx = list.findIndex((r) => r.id === id)
  if (idx === -1) return null
  list[idx] = { ...list[idx], ...patch }
  saveRequirements(list)
  return list[idx]
}

export function addRequirement(r: StoredRequirement): void {
  const list = readRequirements()
  list.push(r)
  saveRequirements(list)
}
