/**
 * 飞书 OAuth 2.0 登录
 */
import { Router } from "express"
import crypto from "node:crypto"
import { auth } from "../lib/auth.js"

const router = Router()

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || "cli_a9646f769479dbd4"
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ""
const AUTH_URL = "https://open.feishu.cn/open-apis/authen/v1/authorize"
const APP_TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal"
const TOKEN_URL = "https://open.feishu.cn/open-apis/authen/v1/oidc/access_token"
const USER_INFO_URL = "https://open.feishu.cn/open-apis/authen/v1/user_info"

let cachedAppToken = ""
let cachedTokenExpiry = 0

async function getAppAccessToken(): Promise<string> {
  if (cachedAppToken && Date.now() < cachedTokenExpiry) {
    return cachedAppToken
  }
  const res = await fetch(APP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET,
    }),
  })
  const data = (await res.json()) as any
  cachedAppToken = data?.app_access_token || ""
  cachedTokenExpiry = Date.now() + (data?.expire || 7200) * 1000 - 60000
  return cachedAppToken
}

/** 跳转飞书授权页 */
router.get("/login", (_req, res) => {
  const state = crypto.randomUUID()
  const redirectUri = `${_req.protocol}://${_req.get("host")}/api/auth/feishu/callback`
  const params = new URLSearchParams({
    app_id: FEISHU_APP_ID,
    redirect_uri: redirectUri,
    state,
    scope: "contact:user.base:readonly",
  })
  res.redirect(`${AUTH_URL}?${params.toString()}`)
})

/** 飞书回调 — 换取 token + 创建/登录用户 */
router.get("/callback", async (req, res) => {
  const { code } = req.query
  if (!code || typeof code !== "string") {
    return res.status(400).send("Missing authorization code")
  }

  try {
    // 1. 获取 app_access_token
    const appToken = await getAppAccessToken()
    if (!appToken) {
      console.error("[feishu] 获取 app_access_token 失败")
      return res.status(500).send("飞书登录失败: app auth failed")
    }

    // 2. 用 app_token + code 换取 user access_token
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${appToken}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
      }),
    })
    const tokenData = (await tokenRes.json()) as any
    const userAccessToken = tokenData?.data?.access_token
    if (!userAccessToken) {
      console.error("[feishu] token 换取失败:", JSON.stringify(tokenData))
      return res.status(500).send("飞书登录失败: token exchange failed")
    }

    // 3. 获取飞书用户信息
    const userRes = await fetch(USER_INFO_URL, {
      headers: { Authorization: `Bearer ${userAccessToken}` },
    })
    const userData = (await userRes.json()) as any
    const feishuUser = userData?.data
    if (!feishuUser?.open_id) {
      console.error("[feishu] 用户信息获取失败:", JSON.stringify(userData))
      return res.status(500).send("飞书登录失败: user info failed")
    }

    const openId = feishuUser.open_id
    const email = `${openId}@feishu.user`
    const name = feishuUser.name || "飞书用户"
    const password = `Feishu_${openId}`
    // username 限制 32 字符，open_id 可能过长，取前 30 位
    const username1 = openId.length > 30 ? openId.slice(0, 30) : openId

    // 4. 确保用户存在（不存在则创建）
    try {
      await auth.api.signInEmail({
        body: { email, password },
        headers: new Headers(req.headers as any),
      } as any)
    } catch {
      try {
        await auth.api.signUpEmail({
          body: { email, password, name, username: username1 },
          headers: new Headers({ "content-type": "application/json" }),
        } as any)
      } catch (e2) {
        console.error("[feishu] 用户创建失败:", e2)
        return res.status(500).send("飞书登录失败: user creation failed")
      }
    }

    // 5. 通过 Better Auth HTTP API 登录，获取正确签名的 session cookie
    const baseURL = process.env.AUTH_BASE_URL || `http://127.0.0.1:${process.env.PORT || "8765"}`
    const loginRes = await fetch(`${baseURL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      redirect: "manual",
    })
    const setCookie = loginRes.headers.get("set-cookie")
    if (setCookie) {
      res.setHeader("Set-Cookie", setCookie)
    }

    res.redirect("/")
  } catch (e) {
    console.error("[feishu] 回调异常:", e)
    res.status(500).send("飞书登录失败")
  }
})

export default router
