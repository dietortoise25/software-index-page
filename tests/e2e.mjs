/**
 * E2E 测试脚本 — 使用 Playwright CLI 执行
 * 用法: node tests/e2e.mjs
 */
import { chromium } from "playwright"

const BASE = "http://42.193.170.109"
const PIN = "123456"

let passed = 0
let failed = 0

function assert(condition, msg) {
  if (condition) { passed++; console.log(`  ✅ ${msg}`) }
  else { failed++; console.error(`  ❌ ${msg}`) }
}

async function testUserJourney(browser) {
  console.log("\n=== 普通用户旅程 ===")
  const page = await browser.newPage()

  // 1. 首页加载
  console.log("\n[1] 首页")
  await page.goto(BASE)
  assert(await page.locator("h1").first().textContent().then(t => t.includes("让机器替你干活")), "首页标题加载")
  assert(await page.locator("footer").textContent().then(t => t.includes("v2.0.0")), "Footer 版本号")
  assert(await page.locator('[aria-label="AI 需求助手"]').count() > 0, "AI需求助手按钮存在")
  assert(await page.locator('[aria-label="提交需求"]').count() > 0, "提交需求按钮存在")

  // 2. 导航到工具库
  console.log("\n[2] 工具库")
  await page.click('a[href="/catalog"]')
  await page.waitForSelector("h1")
  assert(await page.locator("h1").textContent().then(t => t.includes("工具目录") || t.includes("工具")), "工具库页面标题")
  assert(await page.getByText("TF客服值守").count() > 0, "TF客服值守工具显示")

  // 3. 导航到文章
  console.log("\n[3] 文章")
  await page.click('a[href="/articles"]')
  await page.waitForSelector("h1")
  assert(await page.locator("h1").textContent().then(t => t.includes("文章")), "文章页面标题")
  assert(await page.locator("article a, main a[href*='/articles/']").first().count() > 0 || await page.locator("main a").count() > 3, "文章列表有内容")

  // 4. 更新日志
  console.log("\n[4] 更新日志")
  await page.click('a[href="/changelog"]')
  await page.waitForSelector("h1")
  assert(await page.locator("h1").textContent().then(t => t.includes("更新日志")), "更新日志标题")
  assert(await page.getByText("v1.1.0").count() > 0, "v1.1.0 版本记录")
  assert(await page.getByText("v1.0.0").count() > 0, "v1.0.0 版本记录")

  // 5. 快速表单提交
  console.log("\n[5] 快速表单")
  // 通过 API 模拟（避免操控 Dialog）
  const formResp = await page.evaluate(async () => {
    const r = await fetch("/api/requirement", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "type=improvement&priority=medium&title=Playwright E2E 快速表单测试&department=测试部&description=验证快速表单写入JSON和飞书通知&contact=E2E测试"
    })
    return await r.json()
  })
  assert(formResp.ok === true, "快速表单提交成功")

  // 6. AI 聊天 — 打开对话框
  console.log("\n[6] AI 聊天")
  await page.goto(BASE)
  await page.click('[aria-label="AI 需求助手"]')
  await page.waitForTimeout(500)
  assert(await page.getByText("AI 需求助手").count() > 0, "聊天对话框打开")
  assert(await page.getByText("你好！我是AI需求助手").count() > 0, "欢迎消息显示")

  // 7. 发送消息
  const input = page.locator('input[placeholder="描述你的需求..."]')
  await input.fill("Playwright E2E：需要一个自动整理飞书文档的工具")
  await page.waitForTimeout(300)
  // 点击发送
  const sendBtn = page.locator('button').filter({ hasText: "发送" })
  await sendBtn.click()
  await page.waitForTimeout(500)
  // 检查消息是否出现
  assert(await page.getByText("Playwright E2E").count() > 0, "用户消息已发送")

  // 8. 通过 API 模拟提交带排期的需求
  console.log("\n[7] 提交AI需求")
  const chatResp = await page.evaluate(async () => {
    const r = await fetch("/api/requirements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requirement: {
          title: "Playwright E2E AI聊天提交",
          type: "new-tool",
          priority: "high",
          problem: "E2E测试AI聊天提交流程",
          context: "通过浏览器模拟完整提交流程",
          constraints: "测试约束",
          expectedOutcome: "审查面板中出现该需求"
        },
        schedule: {
          estimatedEffort: "small",
          estimatedHours: 2,
          totalWorkDays: 1,
          proposedDeadline: "2026-05-14",
          schedule: [
            { phase: "开发", date: "2026-05-14", startTime: "09:00", endTime: "10:00", description: "实现功能" },
            { phase: "测试", date: "2026-05-14", startTime: "10:00", endTime: "11:00", description: "验证功能" }
          ],
          note: "PLAYWRIGHT_E2E_TEST"
        },
        submitter: "Playwright测试"
      })
    })
    return await r.json()
  })
  assert(chatResp.ok === true, "AI需求提交成功")

  await page.close()
}

async function testAdminJourney(browser) {
  console.log("\n=== 管理员旅程 ===")
  const page = await browser.newPage()

  // 1. 打开审查面板 & PIN 验证
  console.log("\n[1] 审查面板 PIN")
  await page.goto(`${BASE}/review`)
  await page.waitForTimeout(800)
  // 应该显示 PIN 门禁
  const hasPinGate = await page.getByText("管理者验证").count() > 0
  assert(hasPinGate, "PIN 门禁显示")

  // 输入 PIN
  const pinInput = page.locator('input[inputmode="numeric"]')
  await pinInput.fill(PIN)
  await page.getByRole('button', { name: '验证' }).click()
  await page.waitForTimeout(800)

  // 2. 验证面板解锁
  console.log("\n[2] 面板解锁")
  const hasDashboard = await page.getByText("需求审查面板").count() > 0
  assert(hasDashboard, "审查面板解锁成功")
  assert(await page.getByText("待审").count() > 0, "待审标签存在")
  assert(await page.getByText("已通过").count() > 0, "已通过标签存在")
  assert(await page.getByText("已驳回").count() > 0, "已驳回标签存在")

  // 3. 搜索功能
  console.log("\n[3] 搜索")
  const searchInput = page.locator('input[placeholder="搜索标题或提交人..."]')
  await searchInput.fill("Playwright E2E")
  await page.waitForTimeout(300)
  const visibleCards = await page.locator("text=Playwright E2E").count()
  assert(visibleCards > 0, `搜索"Playwright E2E"有结果 (找到${visibleCards}条)`)

  // 清除搜索
  await searchInput.fill("")
  await page.waitForTimeout(200)

  // 4. 找到并审批 AI 聊天提交的需求
  console.log("\n[4] 审批")
  // 点击待审标签确保在待审列表
  await page.locator('button').filter({ hasText: /待审/ }).first().click()
  await page.waitForTimeout(300)

  // 找到 Playwright E2E 的需求卡片上的通过按钮
  const approveBtn = page.locator('button[title="通过"]').first()
  await approveBtn.click()
  await page.waitForTimeout(300)

  // 点击确认
  const confirmBtn = page.locator('button').filter({ hasText: "确认" })
  if (await confirmBtn.count() > 0) {
    await confirmBtn.first().click()
    await page.waitForTimeout(4000) // 等待日历事件创建
    console.log("    审批已确认，等待日历事件...")
  }

  // 5. 切换到已通过验证
  console.log("\n[5] 已通过验证")
  // 先刷新数据
  await page.locator('button').filter({ hasText: "刷新" }).first().click()
  await page.waitForTimeout(800)
  await page.locator('button').filter({ hasText: /已通过/ }).first().click()
  await page.waitForTimeout(500)
  const approvedCount = await page.getByText("Playwright E2E").count()
  assert(approvedCount > 0, `已通过列表有 Playwright E2E 需求 (找到${approvedCount}条)`)

  // 6. 验证日历事件
  console.log("\n[6] 日历事件")
  const calResult = await page.evaluate(async () => {
    const r = await fetch("/api/requirements/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "123456" })
    })
    const d = await r.json()
    const item = d.data.find(r => r.requirement.title.includes("Playwright E2E AI聊天"))
    return item ? { status: item.status, hasSchedule: !!item.schedule?.schedule?.length } : null
  })
  assert(calResult !== null, "找到 Playwright E2E 需求记录")
  assert(calResult?.status === "approved" || calResult?.status === "pending", "需求状态正确")
  assert(calResult?.hasSchedule, "需求包含排期")

  // 7. 驳回测试
  console.log("\n[7] 驳回")
  await page.locator('button').filter({ hasText: /待审/ }).first().click()
  await page.waitForTimeout(300)

  // 找到快速表单提交的那个需求，点击驳回
  const rejectBtn = page.locator('button[title="驳回"]').first()
  if (await rejectBtn.count() > 0) {
    await rejectBtn.click()
    await page.waitForTimeout(300)

    // 填写驳回原因
    const textarea = page.locator('textarea[placeholder="驳回原因（可选）"]')
    if (await textarea.count() > 0) {
      await textarea.first().fill("Playwright E2E 驳回测试原因")
      await page.locator('button').filter({ hasText: "确认驳回" }).first().click()
      await page.waitForTimeout(1000)
    }
  }

  // 8. 退出管理者模式
  console.log("\n[8] 退出管理者模式")
  const exitBtn = page.locator('button').filter({ hasText: /退出管理/ })
  if (await exitBtn.count() > 0) {
    await exitBtn.first().click()
  }
  await page.waitForTimeout(600)
  // 清除 sessionStorage 并重新访问确保门禁
  await page.evaluate(() => sessionStorage.clear())
  await page.goto(`${BASE}/review`)
  await page.waitForSelector('h2', { timeout: 5000 })
  assert(await page.getByText("管理者验证").count() > 0, "退出后回到 PIN 门禁")

  await page.close()
}

// ── 主流程 ──
console.log("🚀 Playwright E2E 测试开始")
console.log(`   目标: ${BASE}`)

const browser = await chromium.launch({ headless: true })

try {
  await testUserJourney(browser)
  await testAdminJourney(browser)
} catch (err) {
  console.error("\n❌ 测试异常:", err.message)
  failed++
}

await browser.close()

console.log(`\n${"━".repeat(40)}`)
console.log(`✅ 通过: ${passed}  ❌ 失败: ${failed}`)
console.log(`${"━".repeat(40)}`)
process.exit(failed > 0 ? 1 : 0)
