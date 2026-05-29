const APP_ID = process.env.FEISHU_APP_ID || ""
const APP_SECRET = process.env.FEISHU_APP_SECRET || ""

interface TokenCache {
  token: string
  expire: number
}

let tokenCache: TokenCache | null = null
let refreshPromise: Promise<string> | null = null

async function fetchToken(): Promise<string> {
  const resp = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  })
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

export async function sendFeishuMessage(
  token: string, receiveId: string, text: string, receiveType: "open_id" | "chat_id" = "open_id",
) {
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receiveType}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: "text",
        content: JSON.stringify({ text }),
      }),
    },
  )
  return (await resp.json()) as { code: number; msg?: string }
}

export async function sendFeishuCard(
  token: string, receiveId: string, card: object, receiveType: "open_id" | "chat_id" = "open_id",
) {
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receiveType}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: "interactive",
        content: JSON.stringify(card),
      }),
    },
  )
  return (await resp.json()) as { code: number; msg?: string }
}
