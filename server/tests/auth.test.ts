import { describe, it, expect } from "vitest"
import { auth } from "../src/lib/auth"

describe("auth module", () => {
  it("creates a Better Auth instance with emailAndPassword plugin", () => {
    expect(auth).toBeDefined()
    expect(auth.api).toBeDefined()
    expect(typeof auth.api.signInEmail).toBe("function")
    expect(typeof auth.api.signOut).toBe("function")
    expect(typeof auth.api.getSession).toBe("function")
  })

  it("has email & password auth enabled", () => {
    const emailAuth = auth.options.emailAndPassword
    expect(emailAuth).toBeDefined()
    expect(emailAuth?.enabled).toBe(true)
  })
})
