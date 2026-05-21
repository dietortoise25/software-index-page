import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: window.location.origin,
})

export const { signIn, signOut, getSession, useSession } = authClient

/** 直接调 username 登录 API，绕过客户端的 email 格式校验 */
export async function signInUsername(payload: { username: string; password: string }) {
  const res = await fetch("/api/auth/sign-in/username", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  })
  const data = await res.json()
  return { error: res.ok ? undefined : data, data: res.ok ? data : undefined }
}
