// 页面桥 — 前端通过这个对象与扩展通信
window.__1688SKU_BRIDGE__ = {
  async queryBatch(offerIds, backendUrl) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: "sku-batch", offerIds, backendUrl },
        (result) => resolve(result || { ok: false, error: "extension no response" })
      );
    });
  },

  async status() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "status" }, (result) => {
        resolve(result || { state: "offline" });
      });
    });
  },
};
