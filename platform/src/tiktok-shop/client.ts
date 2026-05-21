/**
 * TikTok Shop Open Platform — 业务 API Client
 *
 * 所有业务 API 请求都需要：
 *   1. query 带 app_key, access_token, timestamp, sign
 *   2. sign 由 HMAC-SHA256 签名生成
 *
 * API 文档: https://partner.tiktokshop.com/docv2/page/63f6a5fe3b3bc402
 */

import { signUrl } from "./sign.js"
import type { AutoRefreshingAuth } from "./auth.js"

export interface TikTokShopClientOptions {
  /** API 入口点，默认 https://open-api.tiktokglobalshop.com */
  baseUrl?: string
  appKey: string
  appSecret: string
  auth: AutoRefreshingAuth
  timeout?: number
}

export interface TikTokApiResponse<T = unknown> {
  code: number
  message: string
  data?: T
  request_id?: string
}

export class TikTokShopError extends Error {
  code: number
  requestId?: string
  raw: TikTokApiResponse

  constructor(resp: TikTokApiResponse) {
    super(`TikTokShop API Error [${resp.code}]: ${resp.message}`)
    this.name = "TikTokShopError"
    this.code = resp.code
    this.requestId = resp.request_id
    this.raw = resp
  }
}

export class TikTokShopClient {
  readonly baseUrl: string
  readonly appKey: string
  readonly appSecret: string
  private auth: AutoRefreshingAuth
  private timeout: number

  constructor(options: TikTokShopClientOptions) {
    this.baseUrl = (options.baseUrl || "https://open-api.tiktokglobalshop.com").replace(/\/+$/, "")
    this.appKey = options.appKey
    this.appSecret = options.appSecret
    this.auth = options.auth
    this.timeout = options.timeout ?? 30000
  }

  /**
   * 发送 GET 请求（自动签名 + 注入 token）
   */
  async get<T = unknown>(path: string, query?: Record<string, string | undefined>): Promise<T> {
    const accessToken = await this.auth.getAccessToken()
    const timestamp = Math.floor(Date.now() / 1000).toString()

    const url = new URL(`${this.baseUrl}${path}`)
    url.searchParams.set("app_key", this.appKey)
    url.searchParams.set("access_token", accessToken)
    url.searchParams.set("timestamp", timestamp)
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, v)
      }
    }

    const signedUrl = signUrl({ appSecret: this.appSecret, url: url.toString() })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    try {
      const resp = await fetch(signedUrl, {
        method: "GET",
        signal: controller.signal,
      })
      const json: TikTokApiResponse<T> = await resp.json()
      if (json.code !== 0) throw new TikTokShopError(json)
      return json.data as T
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * 发送 POST 请求（自动签名 + 注入 token）
   */
  async post<T = unknown>(path: string, body: unknown, query?: Record<string, string | undefined>): Promise<T> {
    const accessToken = await this.auth.getAccessToken()
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body)

    const url = new URL(`${this.baseUrl}${path}`)
    url.searchParams.set("app_key", this.appKey)
    url.searchParams.set("access_token", accessToken)
    url.searchParams.set("timestamp", timestamp)
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, v)
      }
    }

    const signedUrl = signUrl({ appSecret: this.appSecret, url: url.toString(), body: bodyStr })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    try {
      const resp = await fetch(signedUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyStr,
        signal: controller.signal,
      })
      const json: TikTokApiResponse<T> = await resp.json()
      if (json.code !== 0) throw new TikTokShopError(json)
      return json.data as T
    } finally {
      clearTimeout(timer)
    }
  }
}
