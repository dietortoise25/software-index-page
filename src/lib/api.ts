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
    const json = await resp.json()
    return json as ApiResponse<T>
  } catch {
    return { ok: false, error: "网络请求失败" }
  }
}

/** POST JSON 请求 */
export function apiPost<T = unknown>(url: string, body?: Record<string, unknown>): Promise<ApiResponse<T>> {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
}

