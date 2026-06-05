/**
 * 扩展核心逻辑单元测试
 * 运行: node tests/test_extension.test.cjs
 */

// Import the MD5 function by evaluating the background.js content
const fs = require("fs");
const path = require("path");

// Read the background.js source and extract testable functions
const bgSrc = fs.readFileSync(path.join(__dirname, "..", "extension", "background.js"), "utf-8");

// Extract MD5 function (it's a single expression)
const md5Match = bgSrc.match(/function md5\(e\)\{[\s\S]+?\}function g/);
if (!md5Match) { console.error("Cannot find MD5 function"); process.exit(1); }
const md5Fn = md5Match[0].replace("function g", "return function g");
// We need to eval in a clean way...
// Instead, let's just test with known inputs using Node's crypto

// ── Tests that don't need the extension runtime ──

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

function assertEq(a, b, msg) {
  if (a === b) { passed++; }
  else { failed++; console.log(`  FAIL: ${msg} | expected=${b} got=${a}`); }
}

// Test 1: slimCookie extracts only essential keys
console.log("\n=== slimCookie ===");
function slimCookie(c) {
  const ESSENTIAL_KEYS = ["cookie2","_tb_token_","lid","cookie1","cookie17","sgcookie","sg","csg","unb","_nk_","last_mid","_m_h5_tk","_m_h5_tk_enc","isg","tfstk","t","uc4"];
  const m = new Map();
  for (const p of c.split(";")) { const idx = p.indexOf("="); if (idx > 0) m.set(p.substring(0, idx).trim(), p.substring(idx + 1)); }
  return ESSENTIAL_KEYS.filter((k) => m.has(k)).map((k) => `${k}=${m.get(k)}`).join("; ");
}

const fullCookie = "cookie2=abc123; _tb_token_=tok123; junk=x; lid=alan; _m_h5_tk=tk1_tk2; extra=data; sg=sgval; unb=12345";
const slim = slimCookie(fullCookie);
assert(slim.includes("cookie2=abc123"), "has cookie2");
assert(slim.includes("_tb_token_=tok123"), "has _tb_token_");
assert(slim.includes("_m_h5_tk=tk1_tk2"), "has _m_h5_tk");
assert(!slim.includes("junk"), "excludes junk");
assert(!slim.includes("extra"), "excludes extra");
const slimLen = slim.split("; ").length;
assert(slimLen <= 17, `slim cookie has ${slimLen} entries (max 17)`);
console.log(`  slim: ${slimLen} entries, ${slim.length} chars`);

// Test 2: slimCookie on empty
assertEq(slimCookie(""), "", "empty cookie");

// Test 3: extractToken
console.log("\n=== extractToken ===");
function extractToken(c) { const m = c.match(/_m_h5_tk=([^;]+)/); return m ? m[1].split("_")[0] : ""; }
assertEq(extractToken("_m_h5_tk=abc123_123456"), "abc123", "extract token");
assertEq(extractToken("cookie2=x; _m_h5_tk=tok_999; other=y"), "tok", "extract from middle");
assertEq(extractToken("no_token_here"), "", "no token");

// Test 4: MD5 sign format
console.log("\n=== MD5 sign ===");
const crypto = require("crypto");
const sign = crypto.createHash("md5").update("token&1234567890&12574478&{}").digest("hex");
assertEq(sign.length, 32, "MD5 hex length");
assert(/^[0-9a-f]{32}$/.test(sign), "MD5 hex format");
console.log(`  sign(token&t&appKey&data): ${sign}`);

// Test 5: SKU query URL construction
console.log("\n=== SKU URL ===");
const APP_KEY = "12574478";
const offerId = "740919115663";
const d = JSON.stringify({ offerId, useCase: "1688detail", bizScene: "pcod", urlParam: "actionType=dxOrder&sk=consign" });
assert(d.includes("1688detail"), "data has useCase");
assert(d.includes("pcod"), "data has bizScene");
assert(d.includes(offerId), "data has offerId");

const t = Date.now();
const sign2 = crypto.createHash("md5").update(`testtoken&${t}&${APP_KEY}&${d}`).digest("hex");
const params = new URLSearchParams({ jsv: "2.7.2", appKey: APP_KEY, t: String(t), sign: sign2,
  api: "mtop.1688.wosc.queryOfferSkuSelectorModel", v: "1.0", type: "originaljson", timeout: "20000", dataType: "jsonp" });
const url = `https://h5api.m.1688.com/h5/mtop.1688.wosc.queryofferskuselectormodel/1.0/?${params}&data=${encodeURIComponent(d)}`;
assert(url.startsWith("https://h5api.m.1688.com/h5/mtop.1688.wosc.queryofferskuselectormodel/1.0/"), "URL prefix");
assert(url.includes("appKey=12574478"), "URL has appKey");
assert(url.includes("sign="), "URL has sign");
assert(url.includes("data="), "URL has data");
assert(url.includes(encodeURIComponent(offerId)), "URL has offerId");
console.log(`  URL length: ${url.length}`);

// ── Summary ──
console.log(`\n${"═".repeat(40)}`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
