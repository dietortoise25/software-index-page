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

/** 带 PIN 的 POST JSON 请求（PIN 通过 body 传递） */
export function apiPostWithPin<T = unknown>(url: string, pin: string, body?: Record<string, unknown>): Promise<ApiResponse<T>> {
  return apiPost<T>(url, { pin, ...body })
}

/** 带 PIN 的 GET 请求（PIN 通过 query 传递） */
export function apiGetWithPin<T = unknown>(url: string, pin: string): Promise<ApiResponse<T>> {
  const sep = url.includes("?") ? "&" : "?"
  return request<T>(`${url}${sep}pin=${encodeURIComponent(pin)}`)
}

/** 带 PIN 的 PUT 请求 */
export function apiPutWithPin<T = unknown>(url: string, pin: string, body: Record<string, unknown>): Promise<ApiResponse<T>> {
  return request<T>(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin, ...body }),
  })
}

/** 带 PIN 的 DELETE 请求 */
export function apiDelWithPin<T = unknown>(url: string, pin: string): Promise<ApiResponse<T>> {
  return request<T>(`${url}?pin=${encodeURIComponent(pin)}`, { method: "DELETE" })
}

/** 验证 PIN */
export function verifyPin(pin: string): Promise<ApiResponse> {
  return apiPost("/api/verify-pin", { pin })
}
