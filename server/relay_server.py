"""飞书需求提交中继服务 — 接收前端表单，转发为飞书消息给 Alan"""
import json
import os
import sys
import time
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs

import requests

APP_ID = "cli_a9646f769479dbd4"
APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "NQomqTYaZHapPxb3uDf6HbantJLyOLwQ")
TARGET_NAME = "Alan"
CACHE_FILE = "/tmp/feishu_token_cache.json"


def log(msg: str):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def get_tenant_token():
    try:
        with open(CACHE_FILE) as f:
            cache = json.load(f)
            if cache.get("expire", 0) > time.time() + 60:
                return cache["token"]
    except Exception:
        pass

    resp = requests.post(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        json={"app_id": APP_ID, "app_secret": APP_SECRET},
        timeout=10,
    )
    data = resp.json()
    token = data.get("tenant_access_token", "")
    expire = time.time() + data.get("expire", 7200)

    with open(CACHE_FILE, "w") as f:
        json.dump({"token": token, "expire": expire}, f)

    return token


def get_user_open_id(token, name="Alan"):
    resp = requests.get(
        "https://open.feishu.cn/open-apis/contact/v3/users",
        headers={"Authorization": f"Bearer {token}"},
        params={"page_size": 10, "name": name},
        timeout=10,
    )
    data = resp.json()
    users = data.get("data", {}).get("items", [])
    for u in users:
        # 飞书 API name 可能为 None，模糊匹配或直接取第一个
        if not name or u.get("name") == name or u.get("name") is None:
            return u["open_id"]
    return None


def send_message(token, open_id, content):
    body = {
        "receive_id": open_id,
        "msg_type": "text",
        "content": json.dumps({"text": content}),
    }
    resp = requests.post(
        "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=10,
    )
    return resp.json()


def format_message(form: dict) -> str:
    type_map = {
        "new-tool": "新工具开发",
        "improvement": "功能改进",
        "bugfix": "Bug 修复",
        "automation": "自动化流程",
        "other": "其他",
    }
    pri_map = {
        "urgent": "紧急",
        "high": "高",
        "medium": "中",
        "low": "低",
    }
    return (
        "📋 收到新的需求提交\n"
        f"需求类型：{type_map.get(form.get('type',''), form.get('type',''))}\n"
        f"优先级：{pri_map.get(form.get('priority',''), form.get('priority',''))}\n"
        f"标题：{form.get('title','')}\n"
        f"部门：{form.get('department','未填写')}\n"
        f"期望完成：{form.get('expectedDate','未填写')}\n"
        f"联系方式：{form.get('contact','未填写')}\n"
        f"详细描述：\n{form.get('description','')}"
    )


class RelayHandler(BaseHTTPRequestHandler):

    def _send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self):
        if self.path != "/api/requirement":
            self._send_json(404, {"ok": False, "error": "not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)

            body = None
            for enc in ["utf-8", "gbk", "gb2312", "latin-1"]:
                try:
                    body = raw.decode(enc)
                    break
                except (UnicodeDecodeError, LookupError):
                    continue
            if body is None:
                body = raw.decode("utf-8", errors="replace")

            log(f"收到需求: {body[:200]}")

            form = {}
            for key, values in parse_qs(body).items():
                form[key] = values[0] if values else ""

            token = get_tenant_token()
            open_id = get_user_open_id(token, TARGET_NAME)

            if not open_id:
                log("找不到目标用户")
                self._send_json(500, {"ok": False, "error": "消息发送通道暂不可用，请直接飞书联系 Alan"})
                return

            content = format_message(form)
            result = send_message(token, open_id, content)

            log(f"飞书返回: {result}")
            if result.get("code") == 0:
                self._send_json(200, {"ok": True})
            else:
                self._send_json(500, {"ok": False, "error": f"消息发送失败: {result.get('msg', str(result))}"})

        except Exception as e:
            log(f"处理异常: {traceback.format_exc()}")
            try:
                self._send_json(500, {"ok": False, "error": "服务内部错误，请稍后重试"})
            except Exception:
                pass

    def log_message(self, format, *args):
        log(f"HTTP {args[0]}")


if __name__ == "__main__":
    log("中继服务启动: 127.0.0.1:8765")
    server = HTTPServer(("127.0.0.1", 8765), RelayHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("服务已停止")
        server.shutdown()
