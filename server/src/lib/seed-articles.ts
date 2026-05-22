import type { Pool } from "pg"
import fs from "node:fs"
import path from "node:path"

function parseFrontmatter(raw: string) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return null
  const fm: Record<string, any> = {}
  match[1].split("\n").forEach((line) => {
    const m = line.match(/^(\w+):\s*(.+)/)
    if (!m) return
    const key = m[1], val = m[2]
    if (key === "tags") {
      try { fm.tags = JSON.parse(val) } catch { fm.tags = [] }
    } else {
      fm[key] = val
    }
  })
  return { id: fm.id || "", title: fm.title || "", summary: fm.summary || "", author: fm.author || "", tags: fm.tags || [], date: fm.date || "", content: match[2].trim() }
}

function readPosts(dir: string) {
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({ file: f, ...parseFrontmatter(fs.readFileSync(path.join(dir, f), "utf-8")) }))
      .filter((a: any) => a.title)
  } catch {
    return []
  }
}

interface ArticleSeed {
  slug: string; title: string; summary: string; content: string
  author: string; tags: string[]; date: string
}

export async function seedArticles(pool: Pool): Promise<number> {
  const hardcoded: ArticleSeed[] = [
    { slug: "erp-data-hub-v2", date: "2026-05-15", title: "千易ERP数据中台 v2.0 上线：订单看板 + 广告费用分析 + 运营管理", summary: "从零搭建的ERP数据底座正式投产。41,630条订单、2,938个SKU、27家店铺数据实时同步。", content: "经过两周密集开发，千易ERP数据中台正式投产。核心交付：数据层 TypeScript SDK 封装千易 OpenAPI（14个模块），Supabase 定时同步。看板（/dashboard）：5层交互式分析。内部管理（/dashboard/admin）：运营分组、人员管理、店铺绑定 CRUD。", author: "Alan", tags: ["发布", "数据", "内部"] },
    { slug: "erp-data-warehouse-proposal", date: "2026-05-13", title: "内部提案：轻量级ERP数仓，驱动智能体实现数据决策自动化", summary: "一份面向管理层的推销报告，提出用 Supabase + 千易ERP 构建低成本数据底座。", content: "我们每天有大量ERP数据在'沉睡'——断货损失、客服低效查询、手工报表消耗运营精力。这份提案提出了一套轻量级方案：用 Supabase 作为中转数仓，对接千易ERP API。总实施时间约6-7周，首年总成本约2.2万元。", author: "Alan", tags: ["内部", "数据", "提案"] },
    { slug: "welcome", date: "2026-05-09", title: "Alan 运营工具发布站正式上线", summary: "经过一段时间的筹备，运营自动化工具发布站正式上线，首批工具已开放下载。", content: "经过一段时间的筹备，运营自动化工具发布站正式上线。站点汇聚了公司内部的各类运营自动化工具。首批上线的工具涵盖客服值守、流程编排、数据分析等场景，后续将持续更新。", author: "Alan", tags: ["公告"] },
    { slug: "tf-service-v3.4.1", date: "2026-05-11", title: "TF客服值守 v3.4.1 更新：物流卡片自动发送、无效回复拦截", summary: "v3.4.1 正式发布，新增物流卡片自动发送、防止AI无效回复、非中文界面自动适配。", content: "TF客服值守 v3.4.1 更新亮点：客户询问物流/快递进度时，AI会自动点击发送物流卡片按钮。新增无效回复防护层。修复了非中文ERP界面下值守失效的问题。修复了开关状态显示错误和若干稳定性问题。", author: "Alan", tags: ["发布", "工具"] },
    { slug: "a-shity-helper-v0.1.3", date: "2026-05-11", title: "A Shity Helper v0.1.3 发布：淘宝/天猫数据采集扩展", summary: "首个浏览器扩展工具发布，支持淘宝/天猫商品数据单品及批量采集。", content: "A Shity Helper 是一款 Chrome 扩展，用于淘宝/天猫的商品数据采集。核心功能：单品详情页一键提取、搜索/列表页批量采集并支持自动翻页、智能反风控系统。支持解析SKU面板数据及JSON导出。", author: "Alan", tags: ["发布", "扩展"] },
    { slug: "tf-service-intro", date: "2026-05-09", title: "TF客服值守 v0.1.2 发布说明", summary: "首个自动客服值守工具发布，支持 7×24 智能应答、自动工单处理。", content: "TF客服值守 v0.1.2 是面向运营团队的自动客服值守工具。核心能力：智能识别客户意图并自动应答、自动生成和分派工单、支持多轮对话上下文理解。", author: "Alan", tags: ["发布", "工具"] },
  ]

  const postsDir = process.env.POSTS_DIR || path.resolve("/var/git/build/posts")
  const posts = readPosts(postsDir)
  const allArticles = [...hardcoded, ...posts.map((p: any) => ({ slug: p.id || p.file.replace(".md", ""), title: p.title, summary: p.summary || "", content: p.content, author: p.author || "Alan", tags: p.tags || [], date: p.date || "" }))] as ArticleSeed[]

  for (const a of allArticles) {
    await pool.query(
      `INSERT INTO articles (slug, title, summary, content, author, tags, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'published', $7, $7)
       ON CONFLICT (slug) DO UPDATE SET created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at`,
      [a.slug, a.title, a.summary, a.content, a.author, a.tags, a.date]
    )
  }

  const result = await pool.query("SELECT COUNT(*) FROM articles")
  return parseInt(result.rows[0].count, 10)
}
