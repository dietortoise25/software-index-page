import { Router } from "express"
import http from "http"
import { isRateLimited } from "../lib/rate-limit.js"

const router = Router()
const TARGET = "http://127.0.0.1:8000"

router.all("/*", (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown"
  if (isRateLimited(`shopee:${ip}`, 60, 60_000)) {
    res.status(429).json({ detail: "请求过于频繁，请稍后再试" }); return
  }
  const targetUrl = new URL(req.originalUrl.replace("/api/shopee", "/api"), TARGET)
  const proxyReq = http.request(
    targetUrl,
    { method: req.method, headers: { ...req.headers, host: targetUrl.host } },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
      proxyRes.pipe(res)
    }
  )

  proxyReq.on("error", (err) => {
    console.error(`[shopee-proxy] ${err.message}`)
    if (!res.headersSent) {
      res.status(502).json({ detail: "分析服务暂不可用，请稍后重试" })
    }
  })

  // express.json() 已解析 body，pipe 会发空流 → 手动写入
  const isGetHead = ["GET", "HEAD"].includes(req.method)
  if (!isGetHead && req.body && Object.keys(req.body).length > 0) {
    const bodyStr = JSON.stringify(req.body)
    proxyReq.setHeader("Content-Type", "application/json")
    proxyReq.setHeader("Content-Length", String(Buffer.byteLength(bodyStr)))
    proxyReq.write(bodyStr)
    proxyReq.end()
  } else if (!isGetHead) {
    req.pipe(proxyReq)
  } else {
    proxyReq.end()
  }
})

export default router
