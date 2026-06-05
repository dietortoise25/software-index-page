// 1688 Cookie Bridge — 读取所有 cookie (含 httpOnly) 发送给本地代理

const PROXY_URL = "http://localhost:8766";
const DOMAINS = [".1688.com", ".taobao.com", ".tmall.com", "login.1688.com", "h5api.m.1688.com"];

async function collectAllCookies() {
  let all = [];
  for (const domain of DOMAINS) {
    try {
      const cookies = await chrome.cookies.getAll({ domain });
      all = all.concat(cookies);
    } catch (e) {
      // domain not accessible
    }
  }
  // 组装 cookie 字符串
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function sendToProxy() {
  try {
    const cookie = await collectAllCookies();
    if (!cookie) return { ok: false, error: "未找到 1688 cookie，请先登录 1688" };

    const r = await fetch(`${PROXY_URL}/api/set-cookie`, {
      method: "POST",
      body: cookie,
    });
    const json = await r.json();
    const hasH5tk = cookie.includes("_m_h5_tk=");
    return {
      ok: json.ok,
      cookieLen: cookie.length,
      hasH5tk,
      sample: hasH5tk ? cookie.split("_m_h5_tk=")[1].split(";")[0].substring(0, 20) + "..." : "NONE",
    };
  } catch (e) {
    return { ok: false, error: "代理未启动，请先双击 start_proxy.bat" };
  }
}

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "send-cookie") {
    sendToProxy().then(sendResponse);
    return true; // 异步回复
  }
  if (req.action === "check-proxy") {
    fetch(`${PROXY_URL}/health`)
      .then((r) => r.json())
      .then((data) => sendResponse({ online: true, ...data }))
      .catch(() => sendResponse({ online: false }));
    return true;
  }
});
