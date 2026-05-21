# AI 经营 Copilot — 后端工作清单与技术分析

> 基于 `/future` 前端 mock 的所有功能模块，逐项分析所需后端工作。

---

## 总览

Mock 覆盖 5 个视图 + 1 个抽屉，共涉及 **7 个核心后端域**：

| # | 模块 | 前端 Mock | 后端复杂度 | 预估工时 |
|---|------|-----------|-----------|---------|
| 1 | 事件检测引擎 | 事件流视图 | 高 | 3-4 周 |
| 2 | AI 解释生成 | 事件详情面板 | 中 | 2-3 周 |
| 3 | ChatBI | ChatBI 视图 | 中高 | 3-4 周 |
| 4 | 日报生成 | 日报视图 | 中 | 2-3 周 |
| 5 | Skills 引擎 | Skills 视图 | 高 | 4-5 周 |
| 6 | 订阅与推送 | 设置视图 + PushDrawer | 中 | 2-3 周 |
| 7 | 数据接入层 | 全部视图的底层 | 高 | 4-6 周 |

**总预估：18-28 周（单人），12-16 周（2-3 人并行）**

---

## 1. 事件检测引擎（Event Detection）

### 前端 mock 了什么

- 5 种事件类型：ROI异常 / 销量异常 / 库存异常 / 广告异常 / 利润异常
- 每个事件含：指标名、变化幅度、方向、严重度、时间戳
- 左侧面板按类型筛选、按严重度排序
- 默认概览面板显示事件统计（总数 / 高 / 中 / 低）

### 后端需要做什么

**a. 指标计算层**
```
原始数据 → 聚合计算 → 时序指标
```
- 定时任务（cron）从数据库/API 拉取原始数据，计算 GMV、ROI、毛利率、库存天数、CPM 等
- 存储为时序指标表，供检测引擎消费

**b. 异常检测规则引擎**
```
指标 + 阈值 → 规则匹配 → 事件生成
```
- 支持多种检测策略：
  - 静态阈值：`ROI < 1.5`
  - 环比变化：`GMV 日环比下降 > 10%`
  - 标准差：`CPM 超出 7 日均值 2σ`
  - 连续趋势：`CTR 连续 3 天下降`
- 规则需可配置化（不是硬编码），为 Skills 功能提供基础

**c. 事件持久化**
```
Event { id, eventType, severity, metric, change, direction, timestamp, rawData }
```

### 推荐技术

| 层 | 推荐 | 备选 |
|----|------|------|
| 定时调度 | BullMQ + Redis（已有） | node-cron / Trigger.dev |
| 指标存储 | PostgreSQL（时序表按日分区） | TimescaleDB 扩展 |
| 检测规则 | 自研轻量规则引擎（JSON 配置） | Temporal（太重） |

### 关键设计决策

- **推 vs 拉**：事件检测走推模式（计算层主动检测），不依赖用户打开页面
- **规则复杂度**：MVP 先做静态阈值 + 环比变化，不做 ML 异常检测

---

## 2. AI 解释生成（AI Explanation）

### 前端 mock 了什么

- 事件的 `aiSummary`：自然语言概述（如"ROI从1.8降至1.39，主要由CPM上涨和CTR下降共同导致"）
- 事件的 `possibleCauses`：结构化可能原因列表
- 事件的 `suggestion`：行动建议
- 日报的 AI 总结段落

### 后端需要做什么

**a. AI 归因 Pipeline**
```
事件触发 → 上下文数据收集 → LLM Prompt → 结构化输出解析
```
- 收集上下文：相关指标近期趋势、关联维度数据、历史同期对比
- 构造 Prompt：系统指令 + 事件信息 + 上下文数据 + 输出格式约束
- 解析输出为结构化字段（summary / causes / suggestion）

**b. Prompt 模板管理**
- 每种事件类型对应一个 Prompt 模板
- 模板需要支持变量注入（事件数据、趋势数据等）
- 可被 Skills 覆盖或扩展

**c. 结构化输出解析**
- 要求 LLM 输出 JSON，用 Zod schema 校验
- 解析失败时降级为纯文本展示

### 推荐技术

| 层 | 推荐 |
|----|------|
| LLM | DeepSeek API（项目已有） |
| Prompt 管理 | 服务端 JSON 文件，与 Skills 系统共用 |
| 结构化输出 | Zod + jsonrepair（容错解析） |

### 关键设计决策

- **延迟容忍**：AI 解释可在事件检测后 30 秒内异步生成，事件可先展示"分析中…"
- **缓存策略**：相同事件 + 相同上下文 → 复用缓存结果（Redis，TTL=1h）
- **人工覆盖**：允许用户对 AI 解释进行纠正/补充，反馈回 Prompt 优化

---

## 3. ChatBI（自然语言数据查询）

### 前端 mock 了什么

- 3 个建议问题 + 自由输入
- 单轮问答（问答记录在当前会话保持）
- 回答内容含结构化分析（原因列表、趋势描述、SKU 排行）
- 标记为「单轮问答」MVP 范围

### 后端需要做什么

**a. NL → SQL 转换**
```
用户问题 → LLM → SQL → 数据库执行 → 结果集
```
- Text-to-SQL：将自然语言转为可执行 SQL
- 需要注入：数据库 schema 描述、表关系、字段说明
- 安全限制：只允许 SELECT，加 LIMIT 上限

**b. 分析型回答生成**
```
SQL 结果 + 用户问题 → LLM → 自然语言回答
```
- 将查询结果转为易读的分析回答
- 支持简单的趋势分析和对比

**c. 上下文管理**
- 当前 MVP 为单轮，不需要会话历史
- 但需追踪每个问题的 SQL 和回答用于日志审计

### 推荐技术

| 层 | 推荐 |
|----|------|
| Text-to-SQL | DeepSeek + 精心设计的 schema prompt |
| 查询执行 | PostgreSQL（项目已有 Supabase） |
| 安全沙箱 | Read-only DB user + 语句白名单 + 超时 5s |

### 关键设计决策

- **单轮足够**：MVP 不做多轮对话，避免上下文管理复杂度
- **Schema Prompt 是核心**：Table/Column 描述的质量直接决定 SQL 正确率
- **失败降级**：SQL 语法错误时返回"无法理解，请换种方式提问"

---

## 4. 日报生成（Daily Report）

### 前端 mock 了什么

- 日期标题 + "每日 9:00 飞书推送"
- 4 个核心指标卡片（GMV / 利润 / 订单数 / ROI）
- Top SKU 利润贡献表格（含库存告警）
- AI 总结段落
- 今日异常事件简报

### 后端需要做什么

**a. 日报生成 Pipeline**
```
每日 9:00 触发 → 拉取昨日指标 → 聚合 Top SKU → AI 生成总结 → 组装推送
```
- 定时任务触发
- 汇总昨日核心指标（GMV、利润、订单、ROI）
- 计算 Top SKU 排行（按利润贡献）
- AI 生成自然语言总结
- 收集当天已检测到的高优先级事件

**b. 日报存储**
- 日报持久化，支持历史回溯
- 日报表结构：`{ date, metrics, topSkus, aiSummary, events }`

**c. 推送分发**
- 推送到飞书（见模块 6）
- 同时存储到事件流供前端查询

### 推荐技术

| 层 | 推荐 |
|----|------|
| 定时触发 | BullMQ repeatable job |
| 指标数据 | 事件检测引擎的指标存储 |
| 推送 | 飞书机器人 API（项目已有） |

---

## 5. Skills 引擎（分析能力固化）

### 前端 mock 了什么

- 4 个预设 Skill（ROI 归因 / 库存预警 / 竞品分析 / 广告疲劳检测）
- 每个 Skill：名称 + 自然语言描述 + 触发条件 + 推送对象 + 启用开关 + 共享标记
- 创建 Skill 表单：名称 + 自然语言描述 + 触发条件选择 + 推送对象选择
- Skill 列表支持启用/停用切换

### 后端需要做什么

**a. Skill 数据模型**
```ts
Skill {
  id, name, authorId, description,        // 基础信息
  triggerType, triggerConfig,             // 触发规则
  analysisPrompt,                         // 分析 Prompt 模板
  targetRole,                             // 推送目标
  enabled, shared, createdAt, updatedAt
}
```

**b. Skill 解析器**
```
自然语言描述 → 解析为 → { triggerRules, analysisSteps, outputFormat }
```
- 这是整个系统最难的部分
- 需要 LLM 将自然语言转为结构化规则
- 可能需要人工审核环节

**c. Skill 执行器**
```
定时/事件触发 → 匹配启用 Skill → 收集上下文 → 执行分析 Prompt → 生成结果 → 推送
```
- 复用事件检测引擎的触发机制
- 执行时注入 Skill 特有的 analysisPrompt
- 结果推送到指定角色/用户

**d. Skill 市场**
- 共享 Skill 的发现和复制
- 简单实现：`shared=true` 的 Skill 可被其他用户搜索和复制

### 推荐技术

| 层 | 推荐 |
|----|------|
| Skill 存储 | PostgreSQL JSONB（灵活 schema） |
| NL→规则解析 | DeepSeek（关键 Prompt 工程） |
| 执行引擎 | 事件检测引擎 + AI 解释引擎的组合 |
| 市场 | 简单的列表查询 + 复制 API |

### 关键设计决策

- **Schema 灵活性**：Skill 的 trigger/config 用 JSONB，避免频繁 migration
- **渐进开发**：MVP 先硬编码 4 个预设 Skill，再逐步开放创建
- **安全边界**：用户创建的 Skill 需要审核才能启用（防止恶意 Prompt）
- **权限模型**：作者可编辑/删除，其他人可复制，管理员可强制停用

---

## 6. 订阅与推送（Subscription & Push）

### 前端 mock 了什么

- 5 种事件类型的订阅开关（toggle）
- 每个类型可设自定义阈值滑块
- 3 个推送渠道：站内通知 / 飞书 / 邮件
- 静默时段配置（22:00-08:00）
- PushDrawer：右侧滑出推送消息列表（预警 + 日报）

### 后端需要做什么

**a. 用户订阅管理**
```
User {
  id, subscriptions: [{ eventType, threshold, channels }],
  quietHours: { start, end },
  pushTokens: { feishuOpenId, email }
}
```

**b. 推送分发器**
```
事件生成 → 匹配订阅 → 检查静默时段 → 选择渠道 → 发送
```
- 事件生成后异步匹配订阅用户
- 检查静默时段（紧急事件可忽略）
- 多渠道路由：飞书 Bot → 指定用户 open_id 发送消息

**c. 推送历史**
- 记录所有推送消息
- 前端 PushDrawer 查询最近推送列表

### 推荐技术

| 层 | 推荐 |
|----|------|
| 推送队列 | BullMQ（不同渠道不同队列） |
| 飞书推送 | 项目已有 feishu SDK |
| 邮件推送 | Resend / SendGrid |
| 实时推送 | WebSocket / SSE（站内通知） |

### 关键设计决策

- **Push 克制原则**：默认每天每种事件最多 Push 3 次，避免骚扰
- **优先级覆盖**：高严重度事件忽略静默时段
- **用户粒度**：MVP 推送粒度到角色（广告投放负责人），不做到具体个人

---

## 7. 数据接入层（Data Pipeline）

### 当前项目数据源

基于项目现状，数据主要来自：
- **千易 ERP**：订单、商品、库存、广告费用（已有 SDK + 定时同步）
- **广告平台 API**：TikTok Ads / Google Ads（待接入）
- **飞书**：组织架构、人员信息

### 后端需要做什么

**a. 统一数据总线**
```
千易 ERP → Scheduler → PostgreSQL（已有）
广告平台 → Scheduler → PostgreSQL（新增）
```
- 扩展现有 `qianyi-scheduler` 架构，支持多数据源
- 统一指标计算层消费标准化后的数据

**b. 广告平台接入**
- TikTok Ads API：获取 Campaign/Ad Group/Ad 层级的花费、展示、点击、CPM、CTR、CVR
- Google Ads API：类似维度
- 数据粒度和同步频率：Campaign 级 / 每小时（CPM 检测需要小时级）

**c. 数据质量**
- 缺失值处理（广告 API 偶尔延迟）
- 异常值过滤（单个异常数据点不触发告警）
- 数据血缘追踪

### 推荐技术

| 层 | 推荐 |
|----|------|
| 调度器 | 扩展现有 platform/sync/（TypeScript） |
| 数据存储 | Supabase PostgreSQL（现有） |
| ETL | TypeScript + Drizzle ORM |
| 缓存 | Redis（热点指标） |

---

## 技术栈总结

| 模块 | 核心技术 |
|------|---------|
| 后端运行时 | Node.js + TypeScript（与现有 server 统一） |
| API 框架 | Express（现有）或 NestJS（如需 DI） |
| 数据库 | Supabase PostgreSQL（现有） |
| 队列/调度 | BullMQ + Redis |
| AI/LLM | DeepSeek API（现有） |
| 推送 | 飞书 Bot API（现有） |
| 实时通知 | SSE（Server-Sent Events） |
| 工作流引擎 | 不自建，用 BullMQ 的 job 编排 |

### 为什么不自建 Workflow Engine

Mock 的 Skills 和事件流看起来像需要工作流引擎，但 MVP 阶段：
- 流程是线性的（检测 → 解释 → 推送），不需要复杂 DAG
- BullMQ 的 job dependencies 和 repeatable jobs 够用
- 未来如果需要复杂编排，可以引入 Temporal（单不要现在做）

---

## 开发阶段建议

### 第一阶段（核心闭环 · 4-6 周）

```
数据接入（千易+广告） → 事件检测引擎 → AI 解释 → 飞书推送
```
交付物：5 种事件能被检测、解释、推送到飞书

### 第二阶段（交互增强 · 3-4 周）

```
ChatBI + 日报生成 + 前端 APP
```
交付物：用户可通过自然语言提问、每日自动生成日报

### 第三阶段（能力固化 · 4-5 周）

```
Skills 引擎 + 订阅配置 + 多渠道路由
```
交付物：数分师可创建/分享 Skills，用户可自定义订阅规则

---

## 与现有系统的集成点

| 现有系统 | 集成方式 |
|---------|---------|
| 千易 ERP 同步 | 复用 `qianyi-scheduler`，新增检测触发 |
| 飞书推送 | 复用 `server/src/lib/feishu-*.ts` |
| Supabase | 新增 `copilot` schema |
| Deploy | 复用 `deploy.sh`，systemd 新增 `copilot-scheduler` 服务 |
| 前端 | 复用 shadcn/ui + Tailwind v4 设计系统 |
