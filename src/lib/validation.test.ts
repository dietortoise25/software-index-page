import { describe, it, expect } from "vitest"
import { articleSchema, groupSchema, requirementFormSchema, tiktokCredentialsSchema } from "./validation"

describe("articleSchema", () => {
  const valid = { slug: "test-post", title: "Test", summary: "", content: "# hi", cover_image: "", author: "", tags: [], status: "draft" as const }

  it("有效数据通过", () => {
    expect(articleSchema.safeParse(valid).success).toBe(true)
  })

  it("空 slug 失败", () => {
    const r = articleSchema.safeParse({ ...valid, slug: "" })
    expect(r.success).toBe(false)
  })

  it("非法 slug 字符失败", () => {
    const r = articleSchema.safeParse({ ...valid, slug: "Hello World" })
    expect(r.success).toBe(false)
  })

  it("空标题失败", () => {
    const r = articleSchema.safeParse({ ...valid, title: "" })
    expect(r.success).toBe(false)
  })
})

describe("groupSchema", () => {
  it("有效名称通过", () => {
    expect(groupSchema.safeParse({ name: "技术部" }).success).toBe(true)
  })

  it("空名称失败", () => {
    expect(groupSchema.safeParse({ name: "" }).success).toBe(false)
  })
})

describe("requirementFormSchema", () => {
  const valid = { type: "new-tool", title: "Test", priority: "high", department: "", description: "至少五个字符", expectedDate: "", contact: "" }

  it("有效数据通过", () => {
    expect(requirementFormSchema.safeParse(valid).success).toBe(true)
  })

  it("空 type 失败", () => {
    expect(requirementFormSchema.safeParse({ ...valid, type: "" }).success).toBe(false)
  })

  it("短 description 失败", () => {
    expect(requirementFormSchema.safeParse({ ...valid, description: "ab" }).success).toBe(false)
  })
})

describe("tiktokCredentialsSchema", () => {
  it("有效数据通过", () => {
    expect(tiktokCredentialsSchema.safeParse({ appKey: "k", appSecret: "s", redirectUri: "https://example.com/cb" }).success).toBe(true)
  })

  it("无效 URL 失败", () => {
    expect(tiktokCredentialsSchema.safeParse({ appKey: "k", appSecret: "s", redirectUri: "not-a-url" }).success).toBe(false)
  })
})
