import axios from "axios"
import { generateSign } from "./utils/sign.js"

export class QianyiError extends Error {
  code: string
  raw: unknown

  constructor(code: string, message: string, raw: unknown = null) {
    super(message)
    this.name = "QianyiError"
    this.code = code
    this.raw = raw
  }
}

export interface QianyiClientOptions {
  baseUrl: string
  appId: string
  appSecret: string
  timeout?: number
}

export class QianyiClient {
  baseUrl: string
  appId: string
  appSecret: string
  timeout: number

  constructor({ baseUrl, appId, appSecret, timeout = 30000 }: QianyiClientOptions) {
    this.baseUrl = baseUrl.replace(/\/+$/, "")
    this.appId = appId
    this.appSecret = appSecret
    this.timeout = timeout
  }

  async post(serviceType: string, bizParam: unknown, apiPath: string): Promise<unknown> {
    const timestamp = Date.now()
    const bizParamStr = typeof bizParam === "string" ? bizParam : JSON.stringify(bizParam)
    const sign = generateSign({
      appId: this.appId,
      bizParam: bizParamStr,
      serviceType,
      timestamp,
      appSecret: this.appSecret,
    })

    const formData = new FormData()
    formData.append("appId", this.appId)
    formData.append("serviceType", serviceType)
    formData.append("bizParam", bizParamStr)
    formData.append("timestamp", String(timestamp))
    formData.append("sign", sign)

    const url = `${this.baseUrl}${apiPath}`

    let response
    try {
      response = await axios.post(url, formData, {
        timeout: this.timeout,
        headers: { "Content-Type": "multipart/form-data" },
      })
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && (err.code === "ECONNABORTED" || err.message?.includes("timeout"))) {
        throw new QianyiError("TIMEOUT", "请求超时")
      }
      const msg = err instanceof Error ? err.message : String(err)
      throw new QianyiError("NETWORK_ERROR", `请求异常: ${msg}`)
    }

    const body = response.data as Record<string, unknown>
    if (!body) {
      throw new QianyiError("EMPTY_RESPONSE", "响应内容为空")
    }

    if (body.state !== "success") {
      throw new QianyiError(
        (body.errorCode as string) || "UNKNOWN",
        (body.errorMsg as string) || "未知错误",
        body,
      )
    }

    let bizContent = body.bizContent
    if (typeof bizContent === "string") {
      try {
        bizContent = JSON.parse(bizContent)
      } catch {
        // keep raw string
      }
    }

    return bizContent
  }
}
