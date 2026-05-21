import { useState } from "react"
import { Key, Copy, Play, Terminal, RefreshCw, ExternalLink, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

/* ── 模拟 client 调用（实际应调后端 /api/tiktok-shop/*） ── */

interface TokenData {
  access_token: string
  refresh_token: string
  open_id: string
  seller_name?: string
  access_token_expire_in: number
  refresh_token_expire_in: number
}

function simulateAuthUrl(appKey: string, redirectUri: string) {
  return `https://auth.tiktok-shops.com/api/v2/authorize?app_key=${appKey}&redirect_uri=${encodeURIComponent(redirectUri)}`
}

export default function TikTokShopTestPage() {
  const [step, setStep] = useState(1)
  const [appKey, setAppKey] = useState("")
  const [appSecret, setAppSecret] = useState("")
  const [redirectUri, setRedirectUri] = useState("https://example.com/callback")
  const [authCode, setAuthCode] = useState("")
  const [token, setToken] = useState<TokenData | null>(null)
  const [apiResult, setApiResult] = useState("")
  const [apiPath, setApiPath] = useState("/api/v2/order/search")
  const [running, setRunning] = useState(false)

  const authUrl = appKey ? simulateAuthUrl(appKey, redirectUri) : ""

  const simulateGetToken = async () => {
    setRunning(true)
    await new Promise((r) => setTimeout(r, 1200))
    setToken({
      access_token: "act." + Math.random().toString(36).slice(2, 10),
      refresh_token: "rft." + Math.random().toString(36).slice(2, 10),
      open_id: "open_id_" + Math.random().toString(36).slice(2, 8),
      seller_name: "Test Seller",
      access_token_expire_in: Math.floor(Date.now() / 1000) + 86400,
      refresh_token_expire_in: Math.floor(Date.now() / 1000) + 15552000,
    })
    setRunning(false)
    setStep(3)
  }

  const simulateApiCall = async () => {
    setRunning(true)
    setApiResult("")

    // 模拟签名过程
    const timestamp = Math.floor(Date.now() / 1000)
    await new Promise((r) => setTimeout(r, 800))

    // 展示实际签名串
    const fakeSignText = `${appSecret}${apiPath}app_key${appKey}access_token${token?.access_token}timestamp${timestamp}${appSecret}`
    const fakeSign = "hmac-sha256:" + Array.from(fakeSignText).map(c => c.charCodeAt(0).toString(16)).join("").slice(0, 40)

    setApiResult(
      [
        `── 请求签名 ──`,
        `URL: ${apiPath}`,
        `Query: app_key=${appKey}&access_token=${token?.access_token}&timestamp=${timestamp}&sign=${fakeSign}`,
        ``,
        `── 签名原文 ──`,
        `${appSecret}${apiPath}`,
        `app_key${appKey}access_token${token?.access_token}timestamp${timestamp}`,
        `${appSecret}`,
        ``,
        `── 响应（模拟） ──`,
        `{`,
        `  "code": 0,`,
        `  "message": "success",`,
        `  "data": {`,
        `    "orders": [`,
        `      { "order_id": "577713079621586944", "status": "AWAITING_SHIPMENT", "total": 39.99 },`,
        `      { "order_id": "577713079621586945", "status": "COMPLETED", "total": 24.50 }`,
        `    ]`,
        `  }`,
        `}`,
      ].join("\n"),
    )
    setRunning(false)
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Badge className="rounded-full">platform/src/tiktok-shop/</Badge>
            <Badge variant="secondary" className="rounded-full">TypeScript</Badge>
          </div>
          <h1 className="font-bold text-2xl tracking-tight">TikTok Shop API · 认证调试台</h1>
          <p className="mt-1 text-muted-foreground text-sm">测试 OAuth 认证流程和 API 请求签名</p>
        </div>

        {/* Step 0: 入门引导 */}
        <Card className="p-5 mb-4 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="size-4 text-blue-600 dark:text-blue-400" />
            <span className="font-medium text-sm">如何获取 AppKey / AppSecret</span>
          </div>
          <ol className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-bold mt-0.5">1</span>
              <span>访问 <a href="https://partner.tiktokshop.com/" target="_blank" className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5">TikTok Shop Partner Center<ExternalLink className="size-3" /></a>，注册开发者账号</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-bold mt-0.5">2</span>
              <span>创建应用 → 获取 <code className="rounded bg-blue-100 dark:bg-blue-900 px-1 text-xs">AppKey</code> 和 <code className="rounded bg-blue-100 dark:bg-blue-900 px-1 text-xs">AppSecret</code></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-bold mt-0.5">3</span>
              <span>配置回调地址 → 引导商家授权 → 拿到 authorization_code</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-bold mt-0.5">4</span>
              <span>用 auth_code 在此页面换取 access_token，然后调用业务 API</span>
            </li>
          </ol>
          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 flex items-start gap-2">
            <span className="text-xs text-blue-700 dark:text-blue-300">
              还没有账号？点 <span className="inline-flex items-center gap-0.5 cursor-pointer text-primary underline underline-offset-2" onClick={() => { setAppKey("demo"); setAppSecret("demo"); }}>此处</span> 使用演示模式直接体验第 2-3 步。
            </span>
          </div>
        </Card>

        {/* Step 1: 配置 */}
        <Card className={`p-5 mb-4 transition-all ${step === 1 ? "ring-2 ring-primary/30" : "opacity-60"}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
            <span className="font-medium text-sm">配置 AppKey / AppSecret</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">AppKey</label>
              <input value={appKey} onChange={(e) => setAppKey(e.target.value)}
                placeholder="从 TikTok Shop Partner Center 获取"
                className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm mt-1 outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="text-xs font-medium">AppSecret</label>
              <input value={appSecret} onChange={(e) => setAppSecret(e.target.value)}
                placeholder="与 AppKey 配对"
                className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm mt-1 outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="text-xs font-medium">回调地址</label>
              <input value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)}
                className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm mt-1 outline-none focus:border-primary/50" />
            </div>
            <Button size="sm" onClick={() => setStep(2)} disabled={!appKey || !appSecret}>下一步</Button>
          </div>
        </Card>

        {/* Step 2: 授权 */}
        <Card className={`p-5 mb-4 transition-all ${step === 2 ? "ring-2 ring-primary/30" : step < 2 ? "opacity-40" : "opacity-60"}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
            <span className="font-medium text-sm">OAuth 授权</span>
          </div>

          {step >= 2 && (
            <div className="space-y-3">
              <div className="rounded-lg bg-accent/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">商家授权链接</p>
                <p className="font-mono text-xs break-all select-all">{authUrl}</p>
                <Button variant="ghost" size="sm" className="mt-2"
                  onClick={() => navigator.clipboard.writeText(authUrl)}>
                  <Copy className="size-3 mr-1" />复制链接
                </Button>
              </div>

              <div>
                <label className="text-xs font-medium">回调携带的 authorization_code</label>
                <input value={authCode} onChange={(e) => setAuthCode(e.target.value)}
                  placeholder="模拟输入授权码"
                  className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm mt-1 outline-none focus:border-primary/50 font-mono" />
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={simulateGetToken} disabled={running || !authCode}>
                  {running ? <RefreshCw className="size-3.5 mr-1 animate-spin" /> : <Key className="size-3.5 mr-1" />}
                  换取 token
                </Button>
                <Button variant="ghost" size="sm" onClick={() => simulateGetToken()}>
                  跳过OAuth · 直接模拟 token
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Step 3: API 调用 */}
        <Card className={`p-5 mb-4 transition-all ${step === 3 ? "ring-2 ring-primary/30" : "opacity-40"}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
            <span className="font-medium text-sm">API 调用测试</span>
          </div>

          {token && (
            <div className="space-y-3">
              {/* Token info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ["access_token", token.access_token.slice(0, 16) + "..."],
                  ["open_id", token.open_id],
                  ["seller", token.seller_name || "-"],
                  ["expires", new Date(token.access_token_expire_in * 1000).toLocaleString()],
                ].map(([k, v]) => (
                  <div key={k} className="rounded bg-muted/30 px-2 py-1.5">
                    <span className="text-muted-foreground">{k}</span>
                    <p className="font-mono truncate">{v}</p>
                  </div>
                ))}
              </div>

              {/* API selector */}
              <div>
                <label className="text-xs font-medium">API 路径</label>
                <select value={apiPath} onChange={(e) => setApiPath(e.target.value)}
                  className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm mt-1 outline-none font-mono">
                  <option>/api/v2/order/search</option>
                  <option>/api/v2/product/search</option>
                  <option>/api/v2/inventory/search</option>
                  <option>/api/v2/finance/settlement/search</option>
                  <option>/api/v2/logistics/ship/get</option>
                </select>
              </div>

              <Button size="sm" onClick={simulateApiCall} disabled={running}>
                {running ? <RefreshCw className="size-3.5 mr-1 animate-spin" /> : <Play className="size-3.5 mr-1" />}
                发送请求（调试模式）
              </Button>

              {/* Result */}
              {apiResult && (
                <div className="rounded-lg bg-zinc-950 dark:bg-zinc-900 p-4 font-mono text-xs text-green-400 overflow-x-auto">
                  <pre>{apiResult}</pre>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* 代码位置 */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Terminal className="size-3" />
          实现代码：<code className="rounded bg-muted px-1.5 py-0.5">platform/src/tiktok-shop/</code>
        </div>
      </div>
    </div>
  )
}
