// Content script — 监听页面 postMessage，转发给 background
window.addEventListener("message", (e) => {
  if (e.source !== window || !e.data || e.data._bridge !== "1688-sk-request") return;
  const { _id, action, ...payload } = e.data;

  chrome.runtime.sendMessage({ action, ...payload }, (result) => {
    window.postMessage({
      _bridge: "1688-sk-response",
      _id,
      _result: result || (chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : null),
    }, "*");
  });
});

console.log("[1688 Bridge] content script ready");
