/**
 * 统一 API 请求层
 */

interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
  warnings?: string[]
  deleted?: number
}

async function request<T = unknown>(input: RequestInfo, init?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const resp = await fetch(input, init)
    if (resp.status === 401) {
      const current = encodeURIComponent(window.location.pathname + window.location.search)
      window.location.href = `/login?redirect=${current}`
      return { ok: false, error: "登录已过期，正在跳转..." }
    }
    const json = await resp.json()
    return json as ApiResponse<T>
  } catch {
    return { ok: false, error: "网络请求失败" }
  }
}

/** POST JSON 请求（公开 API，不触发 401 跳转） */
export function apiPost<T = unknown>(url: string, body?: Record<string, unknown>): Promise<ApiResponse<T>> {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
}

