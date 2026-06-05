const btn = document.getElementById("btn");
const status = document.getElementById("status");

function show(msg, cls) {
  status.innerHTML = `<div class="status ${cls}">${msg}</div>`;
}

// 启动时检测代理状态
(async () => {
  const r = await chrome.runtime.sendMessage({ action: "check-proxy" });
  if (r.online) {
    show(`代理在线 · Cookie ${r.cookie_len || "?"} 字符`, "info");
    btn.textContent = "刷新 Cookie";
  } else {
    show("代理未启动，请先双击 start_proxy.bat", "err");
  }
})();

// 发送 cookie
btn.addEventListener("click", async () => {
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 发送中...';

  try {
    const r = await chrome.runtime.sendMessage({ action: "send-cookie" });
    if (r.ok) {
      show(
        `已发送 ${r.cookieLen} 字符${r.hasH5tk ? " · 含 _m_h5_tk ✅" : " · 缺少 _m_h5_tk ⚠️"}<br>` +
        (r.hasH5tk ? `<pre>token: ${r.sample}</pre>` : "请先登录 1688"),
        "ok"
      );
    } else {
      show(r.error || "发送失败", "err");
    }
  } catch (e) {
    show("发送失败: " + e.message, "err");
  }

  btn.disabled = false;
  btn.textContent = "刷新 Cookie";
});
