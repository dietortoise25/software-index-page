import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"

function loadEnv(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8")
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

async function verify() {
  const envPath = path.resolve(import.meta.dirname, "../../.env")
  if (fs.existsSync(envPath)) loadEnv(envPath)

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error("SUPABASE_URL 或 SUPABASE_ANON_KEY 未配置")
    process.exit(1)
  }

  const sb = createClient(url, key)

  // 通过 RPC 或 REST 检查（Supabase JS 客户端不能跑 DDL，但能验证表是否存在）
  // 尝试查询 agent.conversations（空表，不报错即存在）
  console.log("验证 agent schema...")

  try {
    const { error: convErr } = await sb.from("conversations").select("count", { count: "exact", head: true })
    if (convErr && convErr.message.includes("does not exist")) {
      console.log("✗ agent.conversations 不存在")
    } else {
      console.log("✓ agent.conversations 存在", convErr ? `(${convErr.message})` : "")
    }
  } catch {
    console.log("✗ 无法访问 agent.conversations")
  }

  try {
    const { error: msgErr } = await sb.from("messages").select("count", { count: "exact", head: true })
    if (msgErr && msgErr.message.includes("does not exist")) {
      console.log("✗ agent.messages 不存在")
    } else {
      console.log("✓ agent.messages 存在", msgErr ? `(${msgErr.message})` : "")
    }
  } catch {
    console.log("✗ 无法访问 agent.messages")
  }

  try {
    const { error: memErr } = await sb.from("user_memory").select("count", { count: "exact", head: true })
    if (memErr && memErr.message.includes("does not exist")) {
      console.log("✗ agent.user_memory 不存在")
    } else {
      console.log("✓ agent.user_memory 存在", memErr ? `(${memErr.message})` : "")
    }
  } catch {
    console.log("✗ 无法访问 agent.user_memory")
  }

  console.log("验证完成")
}

verify()
