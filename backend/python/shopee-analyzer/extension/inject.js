// Content script — 监听页面 postMessage，转发给 background
window.addEventListener("message", (e) => {
  if (e.source !== window || !e.data || e.data._bridge !== "1688-sk-request") return;
  const { _id, action, ...payload } = e.data;
  console.log("[1688 Bridge] received action:", action, payload.offerIds?.length, "ids");

  chrome.runtime.sendMessage({ action, ...payload }, (result) => {
    if (chrome.runtime.lastError) {
      console.error("[1688 Bridge] background error:", chrome.runtime.lastError.message);
    }
    console.log("[1688 Bridge] background response:", result);
    window.postMessage({
      _bridge: "1688-sk-response",
      _id,
      _result: result || (chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : null),
    }, "*");
  });
});

console.log("[1688 Bridge] content script ready");
