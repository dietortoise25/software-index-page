/**
 * 飞书 API 工具 — token 管理、用户查找、消息发送
 */

const APP_ID = process.env.FEISHU_APP_ID || "cli_a9646f769479dbd4"
const APP_SECRET = process.env.FEISHU_APP_SECRET || ""
interface TokenCache {
  token: string
  expire: number
}

let tokenCache: TokenCache | null = null
let refreshPromise: Promise<string> | null = null

async function fetchToken(): Promise<string> {
  const resp = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
    },
  )
  const data = (await resp.json()) as { tenant_access_token: string; expire: number }
  tokenCache = {
    token: data.tenant_access_token,
    expire: Date.now() + (data.expire || 7200) * 1000,
  }
  return tokenCache.token
}

export async function getTenantToken(): Promise<string> {
  if (tokenCache && tokenCache.expire > Date.now() + 60_000) {
    return tokenCache.token
  }
  if (refreshPromise) return refreshPromise

  refreshPromise = fetchToken().finally(() => { refreshPromise = null })
  return refreshPromise
}

export async function getUserOpenId(_token: string): Promise<string | null> {
  const adminOpenId = process.env.FEISHU_ADMIN_OPEN_ID
  if (adminOpenId) return adminOpenId
  return null
}

/** 发送纯文本飞书消息（保留给快速表单使用） */
export async function sendFeishuMessage(token: string, openId: string, text: string) {
  const resp = await fetch(
    "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receive_id: openId,
        msg_type: "text",
        content: JSON.stringify({ text }),
      }),
    },
  )
  return (await resp.json()) as { code: number; msg?: string }
}

/** 发送飞书互动卡片消息 */
export async function sendFeishuCard(token: string, openId: string, card: object) {
  const resp = await fetch(
    "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receive_id: openId,
        msg_type: "interactive",
        content: JSON.stringify(card),
      }),
    },
  )
  return (await resp.json()) as { code: number; msg?: string }
}

/** 格式化简单表单为纯文本（保留给快速表单） */
export function formatFeishuMessage(form: Record<string, string>): string {
  const typeLabel: Record<string, string> = {
    "new-tool": "新工具开发", improvement: "功能改进",
    bugfix: "Bug 修复", automation: "自动化流程", other: "其他",
  }
  const priLabel: Record<string, string> = {
    urgent: "紧急", high: "高", medium: "中", low: "低",
  }
  return [
    "📋 收到新的需求提交",
    `需求类型：${typeLabel[form.type] || form.type}`,
    `优先级：${priLabel[form.priority] || form.priority}`,
    `标题：${form.title}`,
    `部门：${form.department || "未填写"}`,
    `期望完成：${form.expectedDate || "未填写"}`,
    `联系方式：${form.contact || "未填写"}`,
    `详细描述：`,
    form.description || "",
  ].join("\n")
}
