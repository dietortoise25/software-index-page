import { describe, it, expect, vi, beforeEach } from "vitest"

const mockFetch = vi.fn()
global.fetch = mockFetch

const { getTenantToken, sendFeishuMessage, sendFeishuCard } = await import("../src/lib/feishu.js")

beforeEach(() => { mockFetch.mockReset() })

describe("getTenantToken", () => {
  it("fetches tenant token with correct params", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ tenant_access_token: "tok_test123", expire: 7200 }),
    } as Response)

    const token = await getTenantToken()

    expect(token).toBe("tok_test123")
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/auth/v3/tenant_access_token/internal")
    expect(init.method).toBe("POST")
    const body = JSON.parse(init.body as string)
    expect(body.app_id).toBeDefined()
    expect(body.app_secret).toBeDefined()
  })
})

describe("sendFeishuMessage", () => {
  it("sends text with receive_id_type=chat_id", async () => {
    mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ code: 0 }) } as Response)

    await sendFeishuMessage("tok", "chat_xxx", "hello", "chat_id")

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("receive_id_type=chat_id")
    const body = JSON.parse(init.body as string)
    expect(body.receive_id).toBe("chat_xxx")
    expect(body.msg_type).toBe("text")
    expect(JSON.parse(body.content).text).toBe("hello")
  })

  it("defaults to receive_id_type=open_id", async () => {
    mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ code: 0 }) } as Response)

    await sendFeishuMessage("tok", "ou_xxx", "hi")

    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain("receive_id_type=open_id")
  })
})

describe("sendFeishuCard", () => {
  it("sends interactive card with correct msg_type", async () => {
    mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ code: 0, msg: "ok" }) } as Response)

    const card = { header: { title: { content: "Test", tag: "plain_text" } } }
    await sendFeishuCard("tok", "chat_xxx", card, "chat_id")

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.msg_type).toBe("interactive")
    expect(JSON.parse(body.content)).toEqual(card)
    expect(body.receive_id).toBe("chat_xxx")
  })
})
