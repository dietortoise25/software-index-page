import { describe, it, expect } from "vitest"
import { cn } from "./utils"

describe("cn", () => {
  it("合并类名字符串", () => {
    expect(cn("a", "b")).toBe("a b")
  })

  it("处理条件类名", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible")
  })

  it("用 tailwind-merge 解决冲突", () => {
    expect(cn("px-4", "px-2")).toBe("px-2")
  })

  it("处理 undefined 和 null", () => {
    expect(cn("a", undefined, null, "b")).toBe("a b")
  })

  it("处理空输入", () => {
    expect(cn()).toBe("")
  })
})
