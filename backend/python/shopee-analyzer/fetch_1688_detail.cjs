/**
 * 1688 商品详情抓取 — 用 Puppeteer 打开详情页，提取 iDetailData 里的 SKU 价格。
 *
 * 用法: node fetch_1688_detail.cjs <1688商品链接>
 * 输出: 1688_detail.json
 */
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const fs = require("fs");

const URL = process.argv[2] || "https://detail.1688.com/offer/740919115663.html";

async function main() {
  const browser = await puppeteer.launch({
    headless: true,           // stealth 插件处理反爬
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
  );

  console.log("打开:", URL);
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });

  // 等一下，你可能需要手动过滑块
  console.log("等待 3 秒... 如需手动过验证，现在操作浏览器");
  await new Promise((r) => setTimeout(r, 3000));

  // 截图
  await page.screenshot({ path: "1688_detail.png", fullPage: false });
  console.log("截图: 1688_detail.png");

  // 提取 iDetailData
  const result = await page.evaluate(() => {
    const scripts = document.querySelectorAll("script");
    for (const s of scripts) {
      const text = s.textContent || "";

      // 1688 详情页数据通常在这几个变量里
      for (const key of ["iDetailData", "__INIT_DATA__", "window.__data"]) {
        if (text.includes(key)) {
          // 尝试提取 JSON 赋值
          const re = new RegExp(key + "\\s*=\\s*({[\\s\\S]*?});\\s*\\n\\s*function|" + key + "\\s*=\\s*(.+?);\\s*\\n", "m");
          const m = text.match(re);
          if (m) {
            try {
              return { source: key, data: JSON.parse(m[1] || m[2]) };
            } catch {
              return { source: key, raw: (m[1] || m[2] || "").substring(0, 10000) };
            }
          }
        }
      }
    }
    return null;
  });

  if (result) {
    console.log("数据来源:", result.source);
    const data = result.data || result.raw;

    // 写入 JSON
    fs.writeFileSync("1688_detail.json", typeof data === "string" ? data : JSON.stringify(data, null, 2));
    console.log("已保存: 1688_detail.json");

    // 如果是对象，尝试挖掘 SKU 信息
    if (typeof data === "object") {
      const dumpSku = (obj, depth = 0) => {
        if (depth > 4) return;
        if (!obj || typeof obj !== "object") return;
        for (const k of Object.keys(obj)) {
          if (/sku|price|prop|spec/i.test(k)) {
            console.log(`  [SKU] ${k}:`, JSON.stringify(obj[k]).substring(0, 200));
            if (typeof obj[k] === "object" && depth < 3) dumpSku(obj[k], depth + 1);
          }
        }
        // 也深入常见容器
        for (const c of ["sku", "skuProps", "skuMap", "priceRange", "offer"]) {
          if (obj[c]) dumpSku(obj[c], depth + 1);
        }
      };
      console.log("\nSKU 相关字段:");
      dumpSku(data);

      // 找到 skuProps 或 skuMap 单独输出
      if (data.skuProps) console.log("\nskuProps:", JSON.stringify(data.skuProps, null, 2).substring(0, 3000));
      if (data.skuMap) console.log("\nskuMap:", JSON.stringify(data.skuMap, null, 2).substring(0, 2000));
      if (data.skuPriceRange) console.log("\nskuPriceRange:", JSON.stringify(data.skuPriceRange));
    }
  } else {
    console.log("未找到 iDetailData，保存完整 HTML...");
    const html = await page.content();
    fs.writeFileSync("1688_detail.html", html);
    console.log("已保存: 1688_detail.html");
  }

  await browser.close();
  console.log("\n完成。按任意键退出...");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
