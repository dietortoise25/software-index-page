// 1688 SKU Bridge v3

const APP_KEY = "12574478";
const CONCURRENCY = 6;

// ========== MD5 (standard implementation) ==========
function md5(string) {
  function RotateLeft(lValue, iShiftBits) { return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits)); }
  function AddUnsigned(lX, lY) { var lX8 = (lX & 0x80000000); var lY8 = (lY & 0x80000000); var lX4 = (lX & 0x40000000); var lY4 = (lY & 0x40000000); var lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF); if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8; if (lX4 | lY4) { if (lResult & 0x40000000) return lResult ^ 0xC0000000 ^ lX8 ^ lY8; else return lResult ^ 0x40000000 ^ lX8 ^ lY8; } else return lResult ^ lX8 ^ lY8; }
  function F(x, y, z) { return (x & y) | ((~x) & z); }
  function G(x, y, z) { return (x & z) | (y & (~z)); }
  function H(x, y, z) { return (x ^ y ^ z); }
  function I(x, y, z) { return (y ^ (x | (~z))); }
  function FF(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function GG(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function HH(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function II(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
  function ConvertToWordArray(string) { var lWordCount; var lMessageLength = string.length; var lNumberOfWords_temp1 = lMessageLength + 8; var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64; var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16; var lWordArray = Array(lNumberOfWords - 1); var lBytePosition = 0; var lByteCount = 0; while (lByteCount < lMessageLength) { lWordCount = (lByteCount - (lByteCount % 4)) / 4; lBytePosition = (lByteCount % 4) * 8; lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition)); lByteCount++; } lWordCount = (lByteCount - (lByteCount % 4)) / 4; lBytePosition = (lByteCount % 4) * 8; lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition); lWordArray[lNumberOfWords - 2] = lMessageLength << 3; lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29; return lWordArray; }
  function WordToHex(lValue) { var WordToHexValue = "", WordToHexValue_temp = "", lByte, lCount; for (lCount = 0; lCount <= 3; lCount++) { lByte = (lValue >>> (lCount * 8)) & 255; WordToHexValue_temp = "0" + lByte.toString(16); WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2); } return WordToHexValue; }

  var x = ConvertToWordArray(string);
  var a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
  for (var k = 0; k < x.length; k += 16) {
    var AA = a, BB = b, CC = c, DD = d;
    a = FF(a, b, c, d, x[k + 0], 7, 0xD76AA478); d = FF(d, a, b, c, x[k + 1], 12, 0xE8C7B756); c = FF(c, d, a, b, x[k + 2], 17, 0x242070DB); b = FF(b, c, d, a, x[k + 3], 22, 0xC1BDCEEE);
    a = FF(a, b, c, d, x[k + 4], 7, 0xF57C0FAF); d = FF(d, a, b, c, x[k + 5], 12, 0x4787C62A); c = FF(c, d, a, b, x[k + 6], 17, 0xA8304613); b = FF(b, c, d, a, x[k + 7], 22, 0xFD469501);
    a = FF(a, b, c, d, x[k + 8], 7, 0x698098D8); d = FF(d, a, b, c, x[k + 9], 12, 0x8B44F7AF); c = FF(c, d, a, b, x[k + 10], 17, 0xFFFF5BB1); b = FF(b, c, d, a, x[k + 11], 22, 0x895CD7BE);
    a = FF(a, b, c, d, x[k + 12], 7, 0x6B901122); d = FF(d, a, b, c, x[k + 13], 12, 0xFD987193); c = FF(c, d, a, b, x[k + 14], 17, 0xA679438E); b = FF(b, c, d, a, x[k + 15], 22, 0x49B40821);
    a = GG(a, b, c, d, x[k + 1], 5, 0xF61E2562); d = GG(d, a, b, c, x[k + 6], 9, 0xC040B340); c = GG(c, d, a, b, x[k + 11], 14, 0x265E5A51); b = GG(b, c, d, a, x[k + 0], 20, 0xE9B6C7AA);
    a = GG(a, b, c, d, x[k + 5], 5, 0xD62F105D); d = GG(d, a, b, c, x[k + 10], 9, 0x2441453); c = GG(c, d, a, b, x[k + 15], 14, 0xD8A1E681); b = GG(b, c, d, a, x[k + 4], 20, 0xE7D3FBC8);
    a = GG(a, b, c, d, x[k + 9], 5, 0x21E1CDE6); d = GG(d, a, b, c, x[k + 14], 9, 0xC33707D6); c = GG(c, d, a, b, x[k + 3], 14, 0xF4D50D87); b = GG(b, c, d, a, x[k + 8], 20, 0x455A14ED);
    a = GG(a, b, c, d, x[k + 13], 5, 0xA9E3E905); d = GG(d, a, b, c, x[k + 2], 9, 0xFCEFA3F8); c = GG(c, d, a, b, x[k + 7], 14, 0x676F02D9); b = GG(b, c, d, a, x[k + 12], 20, 0x8D2A4C8A);
    a = HH(a, b, c, d, x[k + 5], 4, 0xFFFA3942); d = HH(d, a, b, c, x[k + 8], 11, 0x8771F681); c = HH(c, d, a, b, x[k + 11], 16, 0x6D9D6122); b = HH(b, c, d, a, x[k + 14], 23, 0xFDE5380C);
    a = HH(a, b, c, d, x[k + 1], 4, 0xA4BEEA44); d = HH(d, a, b, c, x[k + 4], 11, 0x4BDECFA9); c = HH(c, d, a, b, x[k + 7], 16, 0xF6BB4B60); b = HH(b, c, d, a, x[k + 10], 23, 0xBEBFBC70);
    a = HH(a, b, c, d, x[k + 13], 4, 0x289B7EC6); d = HH(d, a, b, c, x[k + 0], 11, 0xEAA127FA); c = HH(c, d, a, b, x[k + 3], 16, 0xD4EF3085); b = HH(b, c, d, a, x[k + 6], 23, 0x4881D05);
    a = HH(a, b, c, d, x[k + 9], 4, 0xD9D4D039); d = HH(d, a, b, c, x[k + 12], 11, 0xE6DB99E5); c = HH(c, d, a, b, x[k + 15], 16, 0x1FA27CF8); b = HH(b, c, d, a, x[k + 2], 23, 0xC4AC5665);
    a = II(a, b, c, d, x[k + 0], 6, 0xF4292244); d = II(d, a, b, c, x[k + 7], 10, 0x432AFF97); c = II(c, d, a, b, x[k + 14], 15, 0xAB9423A7); b = II(b, c, d, a, x[k + 5], 21, 0xFC93A039);
    a = II(a, b, c, d, x[k + 12], 6, 0x655B59C3); d = II(d, a, b, c, x[k + 3], 10, 0x8F0CCC92); c = II(c, d, a, b, x[k + 10], 15, 0xFFEFF47D); b = II(b, c, d, a, x[k + 1], 21, 0x85845DD1);
    a = II(a, b, c, d, x[k + 8], 6, 0x6FA87E4F); d = II(d, a, b, c, x[k + 15], 10, 0xFE2CE6E0); c = II(c, d, a, b, x[k + 6], 15, 0xA3014314); b = II(b, c, d, a, x[k + 13], 21, 0x4E0811A1);
    a = II(a, b, c, d, x[k + 4], 6, 0xF7537E82); d = II(d, a, b, c, x[k + 11], 10, 0xBD3AF235); c = II(c, d, a, b, x[k + 2], 15, 0x2AD7D2BB); b = II(b, c, d, a, x[k + 9], 21, 0xEB86D391);
    a = AddUnsigned(a, AA); b = AddUnsigned(b, BB); c = AddUnsigned(c, CC); d = AddUnsigned(d, DD);
  }
  return (WordToHex(a) + WordToHex(b) + WordToHex(c) + WordToHex(d)).toLowerCase();
}

// ========== Cookie ==========
const ESSENTIAL_KEYS = ["cookie2","_tb_token_","lid","cookie1","cookie17","sgcookie","sg","csg","unb","_nk_","last_mid","_m_h5_tk","_m_h5_tk_enc","isg","tfstk","t","uc4"];

function slimCookie(full) {
  const m = new Map();
  for (const p of full.split(";")) { const idx = p.indexOf("="); if (idx > 0) m.set(p.substring(0, idx).trim(), p.substring(idx + 1)); }
  return ESSENTIAL_KEYS.filter((k) => m.has(k)).map((k) => `${k}=${m.get(k)}`).join("; ");
}

async function collectCookies() {
  const domains = [".1688.com", "h5api.m.1688.com", "detail.1688.com", ".taobao.com"];
  let all = [];
  for (const domain of domains) {
    try { all = all.concat(await chrome.cookies.getAll({ domain })); } catch(e) {}
  }
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

// ========== 单个 SKU 查询 ==========
async function queryOne(offerId, cookie, token) {
  const d = JSON.stringify({ offerId, useCase: "1688detail", bizScene: "pcod", urlParam: "actionType=dxOrder&sk=consign" });
  const t = Date.now();
  const sign = md5(`${token}&${t}&${APP_KEY}&${d}`);
  const params = new URLSearchParams({ jsv: "2.7.2", appKey: APP_KEY, t: String(t), sign, api: "mtop.1688.wosc.queryOfferSkuSelectorModel", v: "1.0", type: "originaljson", timeout: "20000", dataType: "jsonp" });

  try {
    const resp = await fetch(`https://h5api.m.1688.com/h5/mtop.1688.wosc.queryofferskuselectormodel/1.0/?${params}&data=${encodeURIComponent(d)}`, {
      headers: { Cookie: cookie, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Referer: "https://detail.1688.com/" }
    });
    const r = await resp.json();
    const ret = (r.ret || [])[0] || "";
    if (!ret.startsWith("SUCCESS")) return { offerId, sku_count: 0, error: ret };

    const biz = r.data?.skuSelectorBizModel || {};
    const trade = biz.skuSelectorModel?.tradeModel || {};
    const freight = biz.skuSelectorModel?.freightInfo || {};
    const skuProps = (biz.skuSelectorModel?.skuPropsList || biz.skuProps || []).map((p) => ({
      prop: p.prop, values: (p.value || []).map((v) => ({ name: v.name, image_url: v.imageUrl || "" })),
    }));
    const mainImages = (biz.skuSelectorModel?.mainImageList || []).map((img) => img.fullPathImageURI || "");

    const skuMap = biz.skuInfoMap || {};
    const skus = [];
    for (const [spec, info] of Object.entries(skuMap)) {
      skus.push({ spec: spec.split("&gt;")[0], full_spec: spec, price: info.price, discount_price: info.discountPrice, can_book_count: info.canBookCount || 0, sale_count: info.saleCount || 0, sku_id: info.skuId });
    }
    const sorted = skus.sort((a, b) => parseFloat(a.price || "0") - parseFloat(b.price || "0"));
    return {
      offerId, sku_count: skus.length, min_price: sorted[0]?.price || null, max_price: sorted[sorted.length - 1]?.price || null,
      min_price_spec: sorted[0]?.spec || null, skus: sorted, sku_props: skuProps, main_images: mainImages,
      freight: { unit_weight_kg: freight.unitWeight || 0, total_cost_cny: freight.totalCost || 0, location: freight.location || "" },
      trade: { begin_amount: trade.beginAmount || 1, min_price: trade.minPrice || "", max_price: trade.maxPrice || "", price_display: trade.priceDisplay || "", mix_amount: trade.mixModel?.mixAmount || 0, mix_number: trade.mixModel?.mixNumber || 0, support_mix: trade.mixModel?.supportMix || false },
    };
  } catch (e) { return { offerId, sku_count: 0, error: e.message }; }
}

// ========== 批量 → POST 后端 ==========
async function skuBatch(offerIds, backendUrl, analysisId) {
  const fullCookie = await collectCookies();
  if (!fullCookie) return { ok: false, error: "no 1688 cookies" };
  const cookie = slimCookie(fullCookie);
  const token = (cookie.match(/_m_h5_tk=([^;]+)/) || [])[1]?.split("_")[0];
  if (!token) return { ok: false, error: "no _m_h5_tk" };

  const results = [];
  const queue = [...offerIds];

  async function worker() {
    while (queue.length > 0) {
      const oid = queue.shift();
      const r = await queryOne(oid, cookie, token);
      if (r.sku_count > 0) logRun(`SKU ${oid}: ${r.sku_count} skus, min=¥${r.min_price}`);
      else if (r.error) logRun(`SKU ${oid}: FAIL - ${r.error.substring(0, 80)}`);
      results.push(r);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const skuMap = {};
  for (const r of results) { if (r.sku_count > 0) skuMap[r.offerId] = r; }
  try {
    await fetch(`${backendUrl}/api/sourcing/sku-batch`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: true, analysis_id: analysisId || "", sku_data: skuMap, total: results.length, success: Object.keys(skuMap).length }),
    });
  } catch(e) { return { ok: false, error: "POST to backend failed: " + e.message }; }

  return { ok: true, total: results.length, success: Object.keys(skuMap).length };
}

// ========== 运行时日志（暴露给前端） ==========
let runLog = [];

function logRun(msg) {
  const entry = { time: new Date().toISOString(), msg };
  runLog.push(entry);
  if (runLog.length > 50) runLog.shift();
  console.log("[BG]", msg);
}

// ========== 消息路由 ==========
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "sku-batch") {
    logRun(`sku-batch start: ${req.offerIds?.length} ids, backend=${req.backendUrl}`);
    skuBatch(req.offerIds, req.backendUrl, req.analysisId).then((r) => {
      logRun(`sku-batch done: ok=${r.ok}, total=${r.total}, success=${r.success}`);
      sendResponse(r);
    });
    return true;
  }
  if (req.action === "status") {
    collectCookies().then((cookie) => {
      sendResponse({ state: "online", cookie_len: cookie.length, has_h5tk: cookie.includes("_m_h5_tk="), log: runLog.slice(-20) });
    });
    return true;
  }
});
