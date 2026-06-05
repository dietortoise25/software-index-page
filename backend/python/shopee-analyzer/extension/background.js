// 1688 SKU Bridge v3 — 完整流水线：cookie → sign → fetch 1688 → POST 后端

const APP_KEY = "12574478";
const CONCURRENCY = 6;

// ========== MD5 (pure JS) ==========
function md5(e){function r(e,r){return e<<r|e>>>32-r}function t(e,r,t,n,o,i,u){return r(e+r+r+t+n+o+r,i)}function n(e,n,o,i,u,c,s){for(var a=0;a<s;a++)e[a]=n+(n=o)+(o=i)+(i=u),u=a>15?e[a-16]:0,n=(r(n=r(n=r(n=r(n=r(n=r(n=r(n=r(n=r(n=r(n=r(n=r(n=r(n=r(n+=i+u+o+e[a],7)+i,12)+o,17)+n,22)+i+u+o+e[a+1],7)+i,12)+o,17)+n,22)+i+u+o+e[a+5],7)+i,12)+o,17)+n,22)+i+u+o+e[a+13],7)+i,12)+o,17)+n,22)+i+u+o+e[a+9],7)+i,12)+o,17)+n,22),i=r(i=(i=r(i=(i=r(i=(i=r(i=(i=r(i=(i=r(i=(i=r(i=(i=r(i=(i=r(i=(i=r(i=(i=r(i=(i=r(i=(i=r(i=(i=r(i+=e[a+5]+u+o+1859775393,5)+e[a+8],9)+u,14)+o,20)+n+e[a+1]+u+o-1894007588,5)+e[a+4],9)+u,14)+o,20)+n+e[a+7]+u+o-145523070,5)+e[a+10],9)+u,14)+o,20)+n+e[a+13]+u+o+718787259,5)+e[a+0],9)+u,14)+o,20)+n+e[a+3]+u+o-421815835,5)+e[a+6],9)+u,14)+o,20)+n+e[a+9]+u+o+3951481745,5)+e[a+12],9)+u,14)+o,20)+n;return function(r,n,u,c,s){for(var a=0,f=[],l=0;l<r.length;l++)f[l>>>2]|=(r.charCodeAt(l)&255)<<8*(3-l%4);f.push(1<<7|new Date(1970,0).valueOf());for(;f.length%16!=14;)f.push(0);var d=[];for(a=0;a<f.length;a+=16){for(var h=[],p=0;p<4;p++)h.push(f[a+p*4]|0);for(var v=e(g(h,n,u,c,s),g(e(h,n,u,c,s),n,u,c,s),e(h,n,u,c,s),u,c,s),m=e(g(h,n,u,c,s),g(e(h,n,u,c,s),n,u,c,s),n,u,c,s,u),c=0;c<4;c++)h[c]=t(v,m,c);for(p=0;p<4;p++)d.push(h[p])}return d.map(function(e){for(var r="",t=0;t<4;t++)r+="0123456789abcdef".charAt(e>>8*t+4&15)+"0123456789abcdef".charAt(e>>8*t&15);return r}).join("")}([].concat(function(e){for(var r=[],t=0;t<e.length;t++)r.push(e.charCodeAt(t));return r}(function(e){return unescape(encodeURIComponent(e))}(e+"")),function(e){var r=[];e>>=3;for(var t=0;t<e;t++)r.push(0);return r}(e.length)))}function g(e,r,t,n,o){return function(r,t,n,o,i){return r(t^(n|~o),r,i,e)}(r,t,n,o,function(e,r,t,n,o,i,u,c){return function(e,r,t,n,o,i,u){return e(t&n|~t&o,r,e,i,u)}(r,t,n,o,function(e,r,t,n,o,i,u){return e(r,t,function(e,r,t,n,o,i,u){return e(r^n^o,r,t,i,u)}(r,t,n,o,i,u),i,u)}(r,t,n,o,i,u,c),i,u)}(r,t,n,o,function(e,r,t,n,o,i,u){return r((t|~n)^o,r,e,i,u)}(r,t,n,o,function(e,r,t,n,o,i,u,c){return r(r(t^n^o)+c,r,e,i,u)}(r,t,n,o,i,u,1518500249),i,u),i,u))}

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

// ========== 批量 SKU 查询 → POST 回后端 ==========
async function skuBatch(offerIds, backendUrl) {
  const fullCookie = await collectCookies();
  if (!fullCookie) return { ok: false, error: "no 1688 cookies" };
  const cookie = slimCookie(fullCookie);
  const token = (cookie.match(/_m_h5_tk=([^;]+)/) || [])[1]?.split("_")[0];
  if (!token) return { ok: false, error: "no _m_h5_tk" };

  const results = [];
  const queue = [...offerIds];
  let done = 0;

  async function worker() {
    while (queue.length > 0) {
      const oid = queue.shift();
      const r = await queryOne(oid, cookie, token);
      results.push(r);
      done++;
      if (done % 5 === 0 || done === offerIds.length) {
        // 分批 POST 进度给后端
        try { await fetch(`${backendUrl}/api/sourcing/sku-batch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offer_id: oid, progress: { done, total: offerIds.length }, sku_data: r, analysis_id: "" }) }); } catch(e) {}
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // 全部完成，批量 POST
  const skuMap = {};
  for (const r of results) { if (r.sku_count > 0) skuMap[r.offerId] = r; }
  try {
    await fetch(`${backendUrl}/api/sourcing/sku-batch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ complete: true, sku_data: skuMap, total: results.length, success: Object.keys(skuMap).length }) });
  } catch(e) {}

  return { ok: true, total: results.length, success: Object.keys(skuMap).length };
}

// ========== 消息路由 ==========
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "sku-batch") {
    skuBatch(req.offerIds, req.backendUrl).then(sendResponse);
    return true;
  }
  if (req.action === "status") {
    collectCookies().then((cookie) => {
      sendResponse({ state: "online", cookie_len: cookie.length, has_h5tk: cookie.includes("_m_h5_tk=") });
    });
    return true;
  }
});
