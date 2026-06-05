// 页面桥 — 前端通过这个对象与扩展通信
console.log("[1688 Bridge] content script loaded at", location.href);

window.__1688SKU_BRIDGE__ = {
  async queryBatch(offerIds, backendUrl) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: "sku-batch", offerIds, backendUrl },
        (result) => {
          if (chrome.runtime.lastError) {
            console.error("[1688 Bridge] queryBatch error:", chrome.runtime.lastError.message);
            resolve({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(result || { ok: false, error: "extension no response" });
          }
        }
      );
    });
  },

  async status() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "status" }, (result) => {
        if (chrome.runtime.lastError) {
          console.log("[1688 Bridge] status error:", chrome.runtime.lastError.message);
          resolve({ state: "offline" });
        } else {
          resolve(result || { state: "offline" });
        }
      });
    });
  },
};
