/**
 * TikTok Shop Open Platform — 请求签名
 *
 * 签名规则（基于官方文档 + SKIT.FlurlHttpClient.ByteDance 逆向）：
 *   签名串 = appSecret + path + sortedQueryParams + body + appSecret
 *   签名值 = HMAC-SHA256(appSecret, 签名串).toLowerCase()
 *
 * 注意：
 *   - access_token 和 sign 不参与签名
 *   - 空值参数不参与签名，同时从请求中移除
 */
import { createHmac } from "node:crypto"

export function signRequest(params: {
  appSecret: string
  path: string
  queryParams: Record<string, string | undefined>
  body?: string
}): string {
  const { appSecret, path, queryParams, body = "" } = params

  // 1. 过滤掉 access_token / sign / 空值
  const entries = Object.entries(queryParams)
    .filter(([k]) => k !== "access_token" && k !== "sign")
    .filter(([, v]) => v !== undefined && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))

  // 2. 拼接 query 部分
  const queryStr = entries.map(([k, v]) => `${k}${v}`).join("")

  // 3. 组装签名原文
  const signingText = `${appSecret}${path}${queryStr}${body}${appSecret}`

  // 4. HMAC-SHA256 签名
  const hmac = createHmac("sha256", appSecret)
  hmac.update(signingText)
  return hmac.digest("hex").toLowerCase()
}

/**
 * 从 URL 中提取 query 参数的简便方法
 */
export function signUrl(params: {
  appSecret: string
  url: string
  body?: string
}): string {
  const u = new URL(params.url)
  const queryParams: Record<string, string | undefined> = {}
  u.searchParams.forEach((v, k) => {
    queryParams[k] = v
  })

  const signature = signRequest({
    appSecret: params.appSecret,
    path: u.pathname,
    queryParams,
    body: params.body,
  })

  u.searchParams.set("sign", signature)
  return u.toString()
}
