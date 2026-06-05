// Content script — 桥梁
// 页面 JS 上下文 ← postMessage → content script ← chrome.runtime.sendMessage → background

// 1. 注入 API 到页面上下文
const s = document.createElement("script");
s.textContent = `
  (function() {
    let reqId = 0;
    const pending = new Map();

    window.addEventListener("message", (e) => {
      if (e.source !== window || !e.data || e.data._bridge !== "1688-sk-response") return;
      const p = pending.get(e.data._id);
      if (p) { p(e.data._result); pending.delete(e.data._id); }
    });

    function bridgeAction(action, payload) {
      return new Promise((resolve) => {
        const id = ++reqId;
        pending.set(id, resolve);
        window.postMessage({ _bridge: "1688-sk-request", _id: id, action, payload }, "*");
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve(null); } }, 30000);
      });
    }

    window.__1688SKU_BRIDGE__ = {
      queryBatch: (ids, backendUrl) => bridgeAction("sku-batch", { offerIds: ids, backendUrl }),
      status: () => bridgeAction("status", {}),
    };
    console.log("[1688 Bridge] injected");
  })();
`;
(document.head || document.documentElement).appendChild(s);
s.remove();

// 2. 监听页面请求，转发给 background
window.addEventListener("message", (e) => {
  if (e.source !== window || !e.data || e.data._bridge !== "1688-sk-request") return;
  const { _id, action, payload } = e.data;

  chrome.runtime.sendMessage({ action, ...payload }, (result) => {
    window.postMessage({
      _bridge: "1688-sk-response",
      _id,
      _result: result || (chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : null),
    }, "*");
  });
});
