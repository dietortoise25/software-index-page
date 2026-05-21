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
const TOKEN_URL = "https://open.feishu.cn/open-apis/authen/v1/oidc/access_token"
const USER_INFO_URL = "https://open.feishu.cn/open-apis/authen/v1/user_info"

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
    // 1. 用 code 换 token
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET,
      }),
    })
    const tokenData = (await tokenRes.json()) as any
    const accessToken = tokenData?.data?.access_token
    if (!accessToken) {
      console.error("[feishu] token 换取失败:", JSON.stringify(tokenData))
      return res.status(500).send("飞书登录失败: token exchange failed")
    }

    // 2. 获取飞书用户信息
    const userRes = await fetch(USER_INFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const userData = (await userRes.json()) as any
    const feishuUser = userData?.data
    if (!feishuUser?.open_id) {
      console.error("[feishu] 用户信息获取失败:", JSON.stringify(userData))
      return res.status(500).send("飞书登录失败: user info failed")
    }

    const email = `${feishuUser.open_id}@feishu.user`
    const name = feishuUser.name || "飞书用户"

    // 3. 查找或创建用户
    let sessionToken: string | undefined
    try {
      const signInRes = await auth.api.signInEmail({
        body: { email, password: `feishu:${feishuUser.open_id}` },
        headers: new Headers(req.headers as any),
      } as any)
      sessionToken = (signInRes as any)?.token
    } catch {
      // 用户不存在，创建新用户
      try {
        await auth.api.signUpEmail({
          body: {
            email,
            password: `feishu:${feishuUser.open_id}`,
            name,
            username: feishuUser.open_id,
          },
          headers: new Headers({ "content-type": "application/json" }),
        } as any)

        // 登录新用户
        const freshSignIn = await auth.api.signInEmail({
          body: { email, password: `feishu:${feishuUser.open_id}` },
          headers: new Headers(req.headers as any),
        } as any)
        sessionToken = (freshSignIn as any)?.token
      } catch (e2) {
        console.error("[feishu] 用户创建失败:", e2)
        return res.status(500).send("飞书登录失败: user creation failed")
      }
    }

    if (sessionToken) {
      res.cookie("better-auth.session_token", sessionToken, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
    }

    res.redirect("/")
  } catch (e) {
    console.error("[feishu] 回调异常:", e)
    res.status(500).send("飞书登录失败")
  }
})

export default router
