"""
1688 aibuy 图搜客户端 — 纯标准库，可直接嵌入 FastAPI
用法:
    from aibuy_client import search_by_image

    offers, total = search_by_image("https://example.com/image.webp")
    for o in offers:
        print(o["title"], o["itemPrice"])
"""
import json
import base64
import hashlib
import time
import urllib.request
import urllib.parse
import http.cookiejar
from typing import Optional, Tuple, List, Dict, Any

H5API = "https://h5api.m.1688.com"
APP_KEY = "12574478"
_jar: Optional[http.cookiejar.CookieJar] = None
_cs: str = ""
_tk: str = ""


def get_session() -> Tuple[str, str]:
    """
    获取游客 session（纯 HTTP，无需浏览器）。
    返回 (cookie_string, mtop_token)。
    Session 有效期 ~5400 秒，内部自动缓存。
    """
    global _jar, _cs, _tk
    if _tk:
        return _cs, _tk

    _jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_jar))

    url = f"{H5API}/h5/mtop.1688.pc.plugin.safe.heartbeat.key.get/1.0/"
    url += f"?jsv=2.7.2&appKey={APP_KEY}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": "https://www.1688.com/",
    })
    try:
        opener.open(req, timeout=10)
    except Exception:
        pass  # 服务端 Set-Cookie 已经下发

    _cs = "; ".join(f"{c.name}={c.value}" for c in _jar)
    for c in _jar:
        if c.name == "_m_h5_tk":
            _tk = c.value.split("_")[0]
            break
    return _cs, _tk


def reset_session():
    """强制刷新 session（token 过期时调用）"""
    global _jar, _cs, _tk
    _jar = None
    _cs = ""
    _tk = ""


def _mtop_get(api: str, data_obj: dict) -> dict:
    """mtop GET 请求"""
    cs, tk = get_session()
    d = json.dumps(data_obj, separators=(",", ":"))
    t = int(time.time() * 1000)
    s = hashlib.md5(f"{tk}&{t}&{APP_KEY}&{d}".encode()).hexdigest()
    p = f"jsv=2.7.5&appKey={APP_KEY}&t={t}&sign={s}&type=originaljson&v=1.0&ecode=0&dataType=json"
    u = f"{H5API}/h5/{api}?{p}&data={urllib.parse.quote(d)}"
    r = urllib.request.urlopen(urllib.request.Request(u, headers={
        "Cookie": cs, "User-Agent": "Mozilla/5.0",
        "Referer": "https://aibuy.1688.com/",
    }), timeout=30)
    return json.loads(r.read().decode("utf-8"))


def _mtop_post(api: str, data_obj: dict) -> dict:
    """mtop POST 请求"""
    cs, tk = get_session()
    d = json.dumps(data_obj, separators=(",", ":"))
    t = int(time.time() * 1000)
    s = hashlib.md5(f"{tk}&{t}&{APP_KEY}&{d}".encode()).hexdigest()
    p = f"jsv=2.7.5&appKey={APP_KEY}&t={t}&sign={s}&type=originaljson&v=1.0&ecode=0&dataType=json"
    u = f"{H5API}/h5/{api}?{p}"
    f = urllib.parse.urlencode({"data": d}).encode()
    r = urllib.request.urlopen(urllib.request.Request(u, data=f, method="POST", headers={
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cs, "User-Agent": "Mozilla/5.0",
        "Referer": "https://aibuy.1688.com/",
    }), timeout=30)
    return json.loads(r.read().decode("utf-8"))


def _detect_mime(data: bytes) -> str:
    """检测图片 MIME 类型"""
    if data[:4] == b"RIFF":
        return "image/webp"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    return "image/jpeg"


def search_by_image(
    image_input: str,
    page_size: int = 10,
    page: int = 1,
    same_style_only: bool = True,
) -> Tuple[List[Dict[str, Any]], int]:
    """
    以图搜图 — 单张图片 → 1688 候选商品列表

    参数:
        image_input: 图片 URL 或本地文件路径
        page_size:  每页候选数 (默认 10)
        page:       页码 (从 1 开始)
        same_style_only: 是否只返回"高度同款" (默认 True)

    返回:
        (offers_list, total_count)

    每个 offer 包含:
        title, itemId, itemPrice, link, sales,
        offerTags, providerInfo, purchaseInfos 等
    """
    # 1. 加载图片
    if image_input.startswith("http://") or image_input.startswith("https://"):
        data = urllib.request.urlopen(image_input, timeout=15).read()
    else:
        with open(image_input, "rb") as f:
            data = f.read()

    # 2. base64
    mime = _detect_mime(data)
    b64 = f"data:{mime};base64," + base64.b64encode(data).decode()

    # 3. 上传
    r = _mtop_post("mtop.com.alibaba.global.select.aibuy.image.upload/1.0/", {
        "bizType": "ERP",
        "customerId": "wangxiaowang",
        "language": "zh",
        "currency": "CNY",
        "imageBase64": b64,
    })
    iu = r.get("data", {}).get("result", {}).get("imageUrl")
    if not iu:
        raise RuntimeError(f"upload failed: {json.dumps(r, ensure_ascii=False)[:300]}")

    # 4. 搜索
    r = _mtop_get("mtop.com.alibaba.global.select.aibuy.image.search/1.0/", {
        "bizType": "ERP",
        "customerId": "wangxiaowang",
        "language": "zh",
        "currency": "CNY",
        "platform": "1688",
        "beginPage": page,
        "pageSize": page_size,
        "imageUrl": iu,
    })
    offers = r.get("data", {}).get("data", [])
    total = r["data"].get("total", 0)

    # 5. 筛选
    if same_style_only:
        offers = [o for o in offers if "高度同款" in str(o.get("offerTags", []))]

    return offers, total


# ===== 便捷函数 =====

def search_and_export(
    image_input: str,
    top_n: int = 5,
) -> List[dict]:
    """
    搜索并返回精简字段列表，适合直接返回给前端。
    字段: title, price_cny, link, sales, shop_name, min_order, offer_tags
    """
    offers, total = search_by_image(image_input, page_size=top_n)
    return [{
        "title": o.get("title", ""),
        "price_cny": o.get("itemPrice", ""),
        "link": o.get("link", ""),
        "sales": o.get("sales", ""),
        "shop_name": (o.get("providerInfo") or {}).get("companyName", ""),
        "min_order": (o.get("purchaseInfos") or [{}])[0].get("value", ""),
        "offer_tags": o.get("offerTags", []),
    } for o in offers]


# ===== 测试入口 =====
if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        img = sys.argv[1]
    else:
        img = "https://down-ws-cn.img.susercontent.com/file/sg-11134301-825ai-mg54j6h0p9fwc8.webp"
        print(f"使用默认图片: {img[:60]}...\n")

    print("搜索中...")
    offers, total = search_by_image(img, page_size=5)

    print(f"共 {total} 候选, 展示前5个:\n")
    for i, o in enumerate(offers, 1):
        print(f"  #{i} ¥{o['itemPrice']:>6} | {o['title'][:55]}")
        print(f"       {o.get('offerTags',[])} | 销量 {o['sales']}")
    print(f"\n✅ 完成")
