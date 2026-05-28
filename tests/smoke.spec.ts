import { test, expect } from "@playwright/test"

test("首页加载正常", async ({ page }) => {
  const response = await page.goto("/")
  expect(response?.status()).toBe(200)
  await expect(page.locator("body")).not.toBeEmpty()
})

test("导航到看板页面", async ({ page }) => {
  await page.goto("/dashboard")
  await page.waitForLoadState("networkidle")
  expect(page.url()).toContain("/dashboard")
})

test("导航到文章列表", async ({ page }) => {
  await page.goto("/articles")
  await page.waitForLoadState("networkidle")
  expect(page.url()).toContain("/articles")
})
