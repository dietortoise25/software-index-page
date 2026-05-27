import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL || ""
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ""

function getClient() {
  if (!supabaseUrl || !key) {
    throw new Error("SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 未配置")
  }
  return createClient(supabaseUrl, key)
}

export async function query(sql: string, params?: unknown[]) {
  const sb = getClient()

  // 用 supabase-js 的 rpc 或直接走 REST 查询
  // supabase-js 不支持 raw SQL，改用其查询构建器

  // 提取表名（从 FROM 子句）
  const fromMatch = sql.match(/from\s+agent\.(\w+)/i)
  if (!fromMatch) throw new Error(`无法解析表名: ${sql.slice(0, 80)}`)

  const table = fromMatch[1]!

  // SELECT
  if (/^\s*select/i.test(sql)) {
    let q = sb.schema("agent").from(table).select("*")

    // WHERE user_id = $1
    const userIdMatch = sql.match(/user_id\s*=\s*\$1/i)
    if (userIdMatch && params?.[0]) q = q.eq("user_id", params[0] as string)

    // WHERE id = $1 AND user_id = $2
    const idUserMatch = sql.match(/id\s*=\s*\$1.*?user_id\s*=\s*\$2/i)
    if (idUserMatch && params?.[0] && params?.[1]) {
      q = sb.schema("agent").from(table).select("*").eq("id", params[0] as string).eq("user_id", params[1] as string)
    }

    // ORDER BY
    if (/order by/i.test(sql)) {
      if (/updated_at desc/i.test(sql)) q = q.order("updated_at", { ascending: false })
      else if (/created_at asc/i.test(sql)) q = q.order("created_at", { ascending: true })
      else if (/updated_at desc/i.test(sql)) q = q.order("updated_at", { ascending: false })
    }

    const { data, error } = await q
    if (error) throw error
    return { rows: data || [] }
  }

  // INSERT
  if (/^\s*insert/i.test(sql)) {
    if (table === "conversations") {
      const { data, error } = await sb.schema("agent").from(table).insert({
        user_id: params?.[0],
        title: params?.[1] || "新对话",
        agent_type: params?.[2] || "default",
      }).select("*").single()
      if (error) throw error
      return { rows: [data] }
    }
    if (table === "messages") {
      const { data, error } = await sb.schema("agent").from(table).insert({
        conversation_id: params?.[0],
        role: params?.[1],
        content: params?.[2],
        tool_calls: params?.[3],
      }).select("*").single()
      if (error) throw error
      return { rows: [data] }
    }
    if (table === "user_memory") {
      const { data, error } = await sb.schema("agent").from(table).upsert({
        user_id: params?.[0],
        memory_key: params?.[1],
        memory_value: params?.[2],
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,memory_key" }).select("*").single()
      if (error) throw error
      return { rows: [data] }
    }
  }

  // UPDATE
  if (/^\s*update/i.test(sql)) {
    const { error } = await sb.schema("agent").from(table).update({
      updated_at: new Date().toISOString(),
    }).eq("id", params?.[0] as string)
    if (error) throw error
    return { rows: [] }
  }

  // DELETE
  if (/^\s*delete/i.test(sql)) {
    const { error } = await sb.schema("agent").from(table).delete()
      .eq("id", params?.[0] as string).eq("user_id", params?.[1] as string)
    if (error) throw error
    return { rows: [] }
  }

  throw new Error(`未实现的 SQL 模式: ${sql.slice(0, 80)}`)
}
