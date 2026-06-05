/**
 * 1688 本地代理 — 从 Chrome cookie 数据库读取登录态，代理 SKU API 请求。
 *
 * 用法:
 *   node 1688_proxy.cjs          → 端口 8766
 *   node 1688_proxy.cjs --port=9999
 *
 * 端点:
 *   GET  /health          → {"status":"ok"}
 *   GET  /api/sku/:offerId → {"sku_count":N, "skus":[...], ...}
 */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const PORT = parseInt(process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] || "8766");

// ── 从 Chrome 数据库读取 1688 cookie ──

function getChromeCookiesDir() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return "";
  return path.join(localAppData, "Google", "Chrome", "User Data", "Default");
}

function read1688Cookies() {
  const dir = getChromeCookiesDir();
  if (!dir || !fs.existsSync(dir)) {
    console.log("[cookie] Chrome User Data 目录未找到:", dir);
    return "";
  }

  const dbPath = path.join(dir, "Cookies");
  if (!fs.existsSync(dbPath)) {
    console.log("[cookie] Cookies 数据库未找到:", dbPath);
    return "";
  }

  // 用 sqlite3 读 cookie
  const result = spawnSync("sqlite3", [
    dbPath,
    "SELECT host_key, name, value FROM cookies WHERE host_key LIKE '%1688.com'",
  ], { encoding: "utf-8", timeout: 5000 });

  if (result.error || result.status !== 0) {
    console.log("[cookie] sqlite3 读取失败，尝试备选方案...");
    // 备选：从文件加载已保存的 cookie
    try {
      return fs.readFileSync(path.join(__dirname, ".1688_cookies.txt"), "utf-8").trim();
    } catch {
      return "";
    }
  }

  // 组装 cookie 字符串
  const lines = result.stdout.trim().split("\n");
  const parts = lines.map((line) => {
    const [host, name, value] = line.split("|");
    return `${name}=${value}`;
  });
  const cookie = parts.join("; ");

  // 缓存到文件
  fs.writeFileSync(path.join(__dirname, ".1688_cookies_proxy.txt"), cookie);
  console.log(`[cookie] 从 Chrome 读取到 ${parts.length} 个 cookie (${cookie.length} chars)`);
  return cookie;
}

// 加载 cookie
let authCookie = read1688Cookies();
if (!authCookie) {
  // 尝试加载之前保存的
  try {
    authCookie = fs.readFileSync(path.join(__dirname, ".1688_cookies.txt"), "utf-8").trim();
    console.log(`[cookie] 从保存文件加载 (${authCookie.length} chars)`);
  } catch {
    console.log("[cookie] 无可用 cookie，请先登录 1688");
  }
}

// ── 提取签名 token ──

function extractToken(cookie) {
  const m = cookie.match(/_m_h5_tk=([^;]+)/);
  return m ? m[1].split("_")[0] : "";
}

// ── SKU API 查询 ──

function querySku(offerId, callback) {
  const token = extractToken(authCookie);
  if (!token) {
    callback({ error: "no token in cookie" });
    return;
  }

  const d = JSON.stringify({
    offerId,
    useCase: "1688detail",
    bizScene: "pcod",
    urlParam: "actionType=dxOrder&sk=consign",
  });

  const t = Date.now();
  const sign = require("crypto").createHash("md5").update(`${token}&${t}&12574478&${d}`).digest("hex");
  const params = new URLSearchParams({
    jsv: "2.7.2", appKey: "12574478", t: String(t), sign,
    api: "mtop.1688.wosc.queryOfferSkuSelectorModel", v: "1.0",
    type: "originaljson", timeout: "20000", dataType: "jsonp",
  });

  const req = https.request({
    hostname: "h5api.m.1688.com",
    path: `/h5/mtop.1688.wosc.queryofferskuselectormodel/1.0/?${params}&data=${encodeURIComponent(d)}`,
    method: "GET",
    headers: {
      Cookie: authCookie,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Referer: "https://detail.1688.com/",
      Host: "h5api.m.1688.com",
    },
    rejectUnauthorized: false,
    timeout: 10000,
  }, (res) => {
    let body = "";
    res.on("data", (c) => (body += c));
    res.on("end", () => {
      try {
        const r = JSON.parse(body);
        const skuMap = r.data?.skuSelectorBizModel?.skuInfoMap || {};

        const skus = [];
        for (const [spec, info] of Object.entries(skuMap)) {
          skus.push({
            spec: spec.split("&gt;")[0],
            full_spec: spec,
            price: info.price,
            can_book_count: info.canBookCount || 0,
            sku_id: info.skuId,
          });
        }

        const sorted = skus.sort((a, b) => parseFloat(a.price || "0") - parseFloat(b.price || "0"));
        callback({
          sku_count: skus.length,
          min_price: sorted[0]?.price || null,
          max_price: sorted[sorted.length - 1]?.price || null,
          min_price_spec: sorted[0]?.spec || null,
          skus: sorted,
        });
      } catch (e) {
        callback({ sku_count: 0, error: "parse error: " + e.message.substring(0, 100) });
      }
    });
  });

  req.on("error", (e) => callback({ sku_count: 0, error: e.message }));
  req.on("timeout", () => { req.destroy(); callback({ sku_count: 0, error: "timeout" }); });
  req.end();
}

// ── HTTP 服务 ──

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS
  const cors = {};
  cors["Access-Control-Allow-Origin"] = "*";
  cors["Access-Control-Allow-Methods"] = "GET, OPTIONS";
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  // GET /health
  if (url.pathname === "/health") {
    res.writeHead(200, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", cookie_len: authCookie.length }));
    return;
  }

  // GET /api/sku/:offerId
  const skuMatch = url.pathname.match(/^\/api\/sku\/(\d+)$/);
  if (skuMatch) {
    const offerId = skuMatch[1];
    console.log(`[sku] 查询 ${offerId}...`);
    querySku(offerId, (result) => {
      res.writeHead(200, { ...cors, "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(result));
    });
    return;
  }

  // POST /api/set-cookie (手动设置 cookie)
  if (url.pathname === "/api/set-cookie" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      authCookie = body.trim();
      fs.writeFileSync(path.join(__dirname, ".1688_cookies.txt"), authCookie);
      console.log(`[cookie] 手动设置 (${authCookie.length} chars)`);
      res.writeHead(200, { ...cors, "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, len: authCookie.length }));
    });
    return;
  }

  res.writeHead(404, cors);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log("");
  console.log("  1688 本地代理已启动");
  console.log("  ─────────────────────");
  console.log(`  端口: http://localhost:${PORT}`);
  console.log(`  Cookie: ${authCookie ? authCookie.length + " chars" : "未加载"}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log("");
  console.log("  保持此窗口运行，可最小化。");
  console.log("");
});
