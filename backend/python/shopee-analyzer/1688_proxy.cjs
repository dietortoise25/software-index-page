/**
 * 1688 本地代理 — 代理 SKU API 请求，返回全量字段。
 * 用法: node 1688_proxy.cjs
 * 端点: GET /health | GET /api/stats | GET /api/sku/:offerId | POST /api/set-cookie
 */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const PORT = parseInt(process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] || "8766");

function getChromeCookiesDir() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return "";
  return path.join(localAppData, "Google", "Chrome", "User Data", "Default");
}

function fallbackCookie() {
  try { return fs.readFileSync(path.join(__dirname, ".1688_cookies.txt"), "utf-8").trim(); }
  catch { return ""; }
}

function read1688Cookies() {
  const dir = getChromeCookiesDir();
  if (!dir || !fs.existsSync(dir)) { console.log("[cookie] Chrome dir not found"); return fallbackCookie(); }
  let dbPath = path.join(dir, "Network", "Cookies");
  if (!fs.existsSync(dbPath)) dbPath = path.join(dir, "Cookies");
  if (!fs.existsSync(dbPath)) { console.log("[cookie] DB not found"); return fallbackCookie(); }
  console.log("[cookie] reading:", dbPath);
  const result = spawnSync("sqlite3", [dbPath, "SELECT host_key, name, value FROM cookies WHERE host_key LIKE '%1688.com'"], { encoding: "utf-8", timeout: 5000 });
  if (result.error || result.status !== 0) { console.log("[cookie] sqlite3 failed"); return fallbackCookie(); }
  const lines = result.stdout.trim().split("\n");
  const parts = lines.map((line) => { const [host, name, value] = line.split("|"); return `${name}=${value}`; });
  const cookie = parts.join("; ");
  fs.writeFileSync(path.join(__dirname, ".1688_cookies_proxy.txt"), cookie);
  console.log(`[cookie] chrome: ${parts.length} cookies, ${cookie.length} chars`);
  return cookie;
}

let authCookie = read1688Cookies();
if (!authCookie) {
  try { authCookie = fs.readFileSync(path.join(__dirname, ".1688_cookies.txt"), "utf-8").trim(); console.log(`[cookie] file: ${authCookie.length} chars`); }
  catch { console.log("[cookie] none available"); }
}

const ESSENTIAL_KEYS = ["cookie2","_tb_token_","lid","cookie1","cookie17","sgcookie","sg","csg","unb","_nk_","last_mid","_m_h5_tk","_m_h5_tk_enc","isg","tfstk","t","uc4"];

function slimCookie(c) {
  if (!c) return "";
  const m = new Map();
  for (const p of c.split(";")) { const [k,...v] = p.trim().split("="); if (k) m.set(k.trim(), v.join("=")); }
  return ESSENTIAL_KEYS.filter((k) => m.has(k)).map((k) => `${k}=${m.get(k)}`).join("; ");
}

function extractToken(c) { const m = c.match(/_m_h5_tk=([^;]+)/); return m ? m[1].split("_")[0] : ""; }

function querySku(offerId, callback) {
  const token = extractToken(authCookie);
  if (!token) { callback({ sku_count: 0, error: "no token" }); return; }

  const d = JSON.stringify({ offerId, useCase: "1688detail", bizScene: "pcod", urlParam: "actionType=dxOrder&sk=consign" });
  const t = Date.now();
  const sign = require("crypto").createHash("md5").update(`${token}&${t}&12574478&${d}`).digest("hex");
  const params = new URLSearchParams({ jsv: "2.7.2", appKey: "12574478", t: String(t), sign, api: "mtop.1688.wosc.queryOfferSkuSelectorModel", v: "1.0", type: "originaljson", timeout: "20000", dataType: "jsonp" });

  const req = https.request({
    hostname: "h5api.m.1688.com",
    path: `/h5/mtop.1688.wosc.queryofferskuselectormodel/1.0/?${params}&data=${encodeURIComponent(d)}`,
    method: "GET",
    headers: { Cookie: slimCookie(authCookie), "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Referer: "https://detail.1688.com/", Host: "h5api.m.1688.com" },
    rejectUnauthorized: false,
    timeout: 10000,
  }, (res) => {
    let body = "";
    res.on("data", (c) => (body += c));
    res.on("end", () => {
      try {
        const r = JSON.parse(body);
        const ret = (r.ret || [])[0] || "";
        console.log(`[sku] ${offerId}: ret=${ret}`);
        if (!ret.startsWith("SUCCESS")) { callback({ sku_count: 0, error: ret }); return; }

        const biz = r.data?.skuSelectorBizModel || {};
        const trade = biz.skuSelectorModel?.tradeModel || {};
        const freight = biz.skuSelectorModel?.freightInfo || {};
        const skuProps = (biz.skuSelectorModel?.skuPropsList || biz.skuProps || []).map((p) => ({
          prop: p.prop,
          values: (p.value || []).map((v) => ({ name: v.name, image_url: v.imageUrl || "" })),
        }));
        const mainImages = (biz.skuSelectorModel?.mainImageList || []).map((img) => img.fullPathImageURI || "");

        const skuMap = biz.skuInfoMap || {};
        const skus = [];
        for (const [spec, info] of Object.entries(skuMap)) {
          skus.push({
            spec: spec.split("&gt;")[0],
            full_spec: spec,
            price: info.price,
            discount_price: info.discountPrice,
            can_book_count: info.canBookCount || 0,
            sale_count: info.saleCount || 0,
            sku_id: info.skuId,
          });
        }

        const sorted = skus.sort((a, b) => parseFloat(a.price || "0") - parseFloat(b.price || "0"));
        console.log(`[sku] ${offerId}: ${skus.length} skus, min=${sorted[0]?.price}`);
        callback({
          sku_count: skus.length,
          min_price: sorted[0]?.price || null,
          max_price: sorted[sorted.length - 1]?.price || null,
          min_price_spec: sorted[0]?.spec || null,
          skus: sorted,
          sku_props: skuProps,
          main_images: mainImages,
          freight: { unit_weight_kg: freight.unitWeight || 0, total_cost_cny: freight.totalCost || 0, location: freight.location || "" },
          trade: {
            begin_amount: trade.beginAmount || 1,
            min_price: trade.minPrice || "",
            max_price: trade.maxPrice || "",
            price_display: trade.priceDisplay || "",
            mix_amount: trade.mixModel?.mixAmount || 0,
            mix_number: trade.mixModel?.mixNumber || 0,
            support_mix: trade.mixModel?.supportMix || false,
          },
        });
      } catch (e) {
        console.log(`[sku] ${offerId}: parse error ${e.message} raw=${body.substring(0, 200)}`);
        callback({ sku_count: 0, error: "parse error: " + e.message.substring(0, 100) });
      }
    });
  });
  req.on("error", (e) => { console.log(`[sku] ${offerId} error: ${e.message}`); callback({ sku_count: 0, error: e.message }); });
  req.on("timeout", () => { console.log(`[sku] ${offerId} timeout`); req.destroy(); callback({ sku_count: 0, error: "timeout" }); });
  req.end();
}

// ── Cache + Stats ──
const skuCache = new Map();
function getCachedSku(oid) { const c = skuCache.get(oid); if (c && Date.now() - c.ts < 300000) return c.result; return null; }
function setCachedSku(oid, r) { skuCache.set(oid, { result: r, ts: Date.now() }); }
let stats = { queries: 0, successes: 0, errors: 0 };
const lastLogs = [];
function addLog(msg) { lastLogs.push({ time: new Date().toISOString(), msg }); if (lastLogs.length > 20) lastLogs.shift(); }

// ── HTTP ──
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }

  if (url.pathname === "/health") {
    res.writeHead(200, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", cookie_len: authCookie.length, stats }));
    return;
  }
  if (url.pathname === "/api/stats") {
    res.writeHead(200, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ stats, logs: lastLogs }));
    return;
  }
  const skuMatch = url.pathname.match(/^\/api\/sku\/(\d+)$/);
  if (skuMatch) {
    const offerId = skuMatch[1]; stats.queries++;
    const cached = getCachedSku(offerId);
    if (cached) { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); res.end(JSON.stringify(cached)); return; }
    addLog("query " + offerId + "...");
    querySku(offerId, (result) => {
      if (result.sku_count > 0) { stats.successes++; setCachedSku(offerId, result); addLog(offerId + ": " + result.sku_count + " SKUs, min=" + result.min_price); }
      else { stats.errors++; addLog(offerId + ": FAIL - " + (result.error || "no data")); }
      res.writeHead(200, { ...cors, "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(result));
    });
    return;
  }
  if (url.pathname === "/api/set-cookie" && req.method === "POST") {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const incoming = body.trim();
      if (incoming.includes("_m_h5_tk=")) { authCookie = incoming; }
      else if (incoming.includes("_") && incoming.length < 80) { const tk = incoming; const ex = authCookie || fallbackCookie(); authCookie = ex.includes("_m_h5_tk=") ? ex.replace(/_m_h5_tk=[^;]+/, "_m_h5_tk=" + tk) : (ex ? ex + "; _m_h5_tk=" + tk : "_m_h5_tk=" + tk); }
      else { const ex = authCookie?.includes("_m_h5_tk=") ? authCookie : ""; const hp = ex.match(/_m_h5_tk=[^;]+/) || []; authCookie = incoming + (hp[0] ? "; " + hp[0] : ""); }
      fs.writeFileSync(path.join(__dirname, ".1688_cookies.txt"), authCookie);
      const has = authCookie.includes("_m_h5_tk=");
      console.log("[cookie] set (" + authCookie.length + " chars, h5tk=" + (has ? "YES" : "NO") + ")");
      res.writeHead(200, { ...cors, "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true, len: authCookie.length, has_h5tk: has }));
    }); return;
  }
  res.writeHead(404, cors); res.end("Not Found");
});

server.listen(PORT, () => {
  console.log("\n  1688 local proxy :" + PORT);
  console.log("  cookie: " + (authCookie ? authCookie.length + " chars" : "NONE"));
});
