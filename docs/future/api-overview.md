# API 接口文档索引

> 前端 Mock → API 契约 对照表

## 文件

| 文件 | 内容 |
|------|------|
| [`api-contracts.ts`](./api-contracts.ts) | 完整 TypeScript 类型定义 + 所有接口签名 |
| [`backend-requirements.md`](./backend-requirements.md) | 后端工作清单与技术分析 |

## UI 模块 → API 映射

| 前端视图 | 使用的 API | 说明 |
|---------|-----------|------|
| 事件流（左面板） | `GET /events?type=&severity=&since=&limit=&offset=` | 事件列表 + 筛选 |
| 事件流（概览面板） | `GET /events/overview` | 右侧默认概览统计 |
| 事件详情（右面板） | `GET /events/:id` | 点击事件后加载完整详情 |
| ChatBI | `POST /chat` | 发送问题，返回分析回答 + SQL |
| 日报 | `GET /reports/latest` 或 `/reports/:date` | 日报数据 + 历史回溯 |
| Skills 列表 | `GET /skills` | 我的 Skills + 筛选 |
| Skills 详情 | `GET /skills/:id` | 查看单个 Skill |
| Skills 创建 | `POST /skills` | 创建新 Skill |
| Skills 开关 | `POST /skills/:id/toggle` | 启用/停用 |
| Skills 复制 | `POST /skills/:id/copy` | 复制公开 Skill |
| Skills 市场 | `GET /skills/market` | 浏览共享 Skill |
| 设置 — 订阅 | `GET /settings` + `PUT /settings` | 读/写订阅配置 |
| Push 抽屉 | `GET /pushes` | 推送消息列表 |
| Push 已读 | `POST /pushes/read` | 标记已读 |
| 实时通知 | `GET /stream` (SSE) | 新事件/新推送实时提醒 |

## 接口一览

```
GET    /api/copilot/events             事件列表（支持筛选分页）
GET    /api/copilot/events/overview    事件概览统计
GET    /api/copilot/events/:id         事件详情

POST   /api/copilot/chat               ChatBI 提问

GET    /api/copilot/reports/latest     最新日报
GET    /api/copilot/reports/:date      指定日期日报

GET    /api/copilot/skills             我的 Skills
POST   /api/copilot/skills             创建 Skill
PUT    /api/copilot/skills/:id         更新 Skill
DELETE /api/copilot/skills/:id         删除 Skill
POST   /api/copilot/skills/:id/toggle  启用/停用
POST   /api/copilot/skills/:id/copy    复制 Skill
GET    /api/copilot/skills/market      技能市场

GET    /api/copilot/settings           获取订阅配置
PUT    /api/copilot/settings           更新订阅配置

GET    /api/copilot/pushes             推送消息列表
POST   /api/copilot/pushes/read        标记已读
POST   /api/copilot/pushes/read/:id    标记单条已读

GET    /api/copilot/stream             SSE 实时流
```

## 使用方式

前端调用示例：

```ts
import type { BusinessEvent, PaginatedResponse, ChatAnswer } from "@/types/copilot"

// 获取事件列表
const res = await fetch("/api/copilot/events?type=roi&severity=high")
const { data, total } = await res.json() as PaginatedResponse<BusinessEvent>

// ChatBI 提问
const res2 = await fetch("/api/copilot/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question: "为什么今天销量下降？" })
})
const { data: answer } = await res2.json() as ApiResponse<ChatAnswer>
```
