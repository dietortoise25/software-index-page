/**
 * TikTok Shop Open Platform — 认证模块
 *
 * API 文档: https://partner.tiktokshop.com/docv2/page/63f68b5af6394002
 *
 * 认证流程:
 *   1. 引导商家授权 → 获取 authorization_code
 *   2. GET /api/v2/token/get?grant_type=authorized_code&code=xxx  → 获得 access_token + refresh_token
 *   3. GET /api/v2/token/refresh?grant_type=refresh_token&refresh_token=xxx → 刷新 access_token
 *
 * 注意：
 *   - Auth API 走独立的 auth 域名，不需要 HMAC 签名
 *   - 业务 API 走 main 域名，需要 HMAC 签名 + query 中带 app_key, access_token, timestamp, sign
 */

// ── Auth API 响应类型 ──

export interface TokenData {
  access_token: string
  access_token_expire_in: number // Unix 时间戳（秒）
  refresh_token: string
  refresh_token_expire_in: number // Unix 时间戳（秒）
  open_id: string
  user_type: number
  seller_name?: string
  seller_base_region?: string
  granted_permissions?: string[]
}

export interface TikTokAuthResponse {
  code: number
  message: string
  data?: TokenData
}

// ── Auth Client ──

export interface TikTokAuthClientOptions {
  /** Auth API 入口点，默认 https://auth.tiktok-shops.com */
  authBaseUrl?: string
  appKey: string
  appSecret: string
}

export class TikTokAuthClient {
  readonly authBaseUrl: string
  readonly appKey: string
  readonly appSecret: string

  constructor(options: TikTokAuthClientOptions) {
    this.authBaseUrl = (options.authBaseUrl || "https://auth.tiktok-shops.com").replace(/\/+$/, "")
    this.appKey = options.appKey
    this.appSecret = options.appSecret
  }

  /**
   * 用 authorization_code 换取 access_token。
   * 这是 OAuth 流程的第二步。第一步引导商家打开授权页面获取 code。
   */
  async getToken(authCode: string): Promise<TokenData> {
    const url = new URL(`${this.authBaseUrl}/api/v2/token/get`)
    url.searchParams.set("grant_type", "authorized_code")
    url.searchParams.set("code", authCode)

    const resp = await fetch(url.toString(), { method: "GET" })
    const json: TikTokAuthResponse = await resp.json()

    if (json.code !== 0 || !json.data) {
      throw new Error(`TikTok Auth getToken 失败: [${json.code}] ${json.message}`)
    }

    return json.data
  }

  /**
   * 刷新 access_token。
   * access_token 有效期约 24 小时，过期前需刷新。
   */
  async refreshToken(refreshToken: string): Promise<TokenData> {
    const url = new URL(`${this.authBaseUrl}/api/v2/token/refresh`)
    url.searchParams.set("grant_type", "refresh_token")
    url.searchParams.set("refresh_token", refreshToken)

    const resp = await fetch(url.toString(), { method: "GET" })
    const json: TikTokAuthResponse = await resp.json()

    if (json.code !== 0 || !json.data) {
      throw new Error(`TikTok Auth refreshToken 失败: [${json.code}] ${json.message}`)
    }

    return json.data
  }

  /**
   * 生成商家授权 URL。
   * 商家打开此 URL 完成授权后，会重定向到 redirectUri 并带上 authorization_code。
   */
  buildAuthUrl(redirectUri: string, state?: string): string {
    const url = new URL(`${this.authBaseUrl}/api/v2/authorize`)
    url.searchParams.set("app_key", this.appKey)
    url.searchParams.set("redirect_uri", redirectUri)
    if (state) url.searchParams.set("state", state)
    return url.toString()
  }
}

// ── Token 管理 ──

/**
 * 带自动刷新的 token 提供器。
 * 每次获取 token 时检查 expiry，过期前自动刷新。
 */
export interface TokenStore {
  get(): Promise<TokenData | null>
  set(data: TokenData): Promise<void>
}

export class AutoRefreshingAuth {
  private authClient: TikTokAuthClient
  private store: TokenStore
  /** 提前多少秒刷新（默认 1800 = 30 分钟） */
  private refreshAheadSeconds: number

  constructor(authClient: TikTokAuthClient, store: TokenStore, refreshAheadSeconds = 1800) {
    this.authClient = authClient
    this.store = store
    this.refreshAheadSeconds = refreshAheadSeconds
  }

  async getAccessToken(): Promise<string> {
    let token = await this.store.get()
    if (!token) throw new Error("未找到 TikTok token，请先完成 OAuth 授权")

    const now = Math.floor(Date.now() / 1000)
    if (token.access_token_expire_in - now < this.refreshAheadSeconds) {
      token = await this.authClient.refreshToken(token.refresh_token)
      await this.store.set(token)
    }

    return token.access_token
  }

  async exchangeAndSave(authCode: string): Promise<TokenData> {
    const token = await this.authClient.getToken(authCode)
    await this.store.set(token)
    return token
  }
}
