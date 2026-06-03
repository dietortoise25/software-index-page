# 开发计划：选品比价工具

## 故事优先级

| 优先级 | 故事 | 原因 |
|--------|------|------|
| P0 | US-9 工具入口 | 页面不存在什么都做不了 |
| P0 | US-1 文件上传 | 核心流程起点 |
| P0 | US-4 成本配置 | 分析的前置输入 |
| P0 | US-2 SSE 进度 | 核心交互，用户观测分析进展 |
| P0 | US-5 结果表格 | 核心交付物 |
| P1 | US-3 候选详情 | 增强体验，展开看供应商 |
| P1 | US-6 汇总统计 | 增强体验，一眼看全局 |
| P1 | US-8 导出 Excel | 离线分享需求 |
| P2 | US-7 配置持久化 | 锦上添花，减少重复输入 |

## 开发顺序 & 依赖

```
US-9 ──→ US-1 ──→ US-4 ──→ US-2 ──→ US-5 ──→ US-3
 入口      上传     配置     SSE进度   结果表    候选展开
                                    │
                                    ├──→ US-6 (汇总统计)
                                    ├──→ US-8 (导出Excel)
                                    └──→ US-7 (配置持久化，可与US-4并行)
```

US-7 打开页面即调 GET，可与 US-4 表单复用同一组件，开发上放在一起做。

## 技术方案

### 架构图

```mermaid
flowchart TD
    subgraph Frontend[前端 SPA :5173]
        PG[SourcingToolPage<br/>路由 /sourcing-tool]
        FD[FileDropzone<br/>多文件上传+预览]
        CF[CostConfigForm<br/>成本输入+保存/恢复]
        PP[ProgressPanel<br/>SSE进度条+产品状态列表]
        RT[ResultTable<br/>可展开结果表+四色推荐]
        SB[SummaryBar<br/>汇总统计Badge]
        EB[ExportButton<br/>SheetJS导出Excel]
        SL[sourcing.ts<br/>SSE客户端+config API]
    end

    subgraph Express[Express :8765]
        PR[/api/shopee/sourcing/*<br/>透明代理]
    end

    subgraph FastAPI[FastAPI :8000]
        SR[sourcing.py<br/>多文件解析+搜图+成本]
        AC[aibuy_client.py<br/>1688游客态API]
        CFG[config.py<br/>YAML配置CRUD]
    end

    subgraph External[外部]
        A88[1688 MTOP API<br/>图片上传+搜索]
    end

    PG --> FD & CF & PP & RT & SB & EB
    SL -->|fetch SSE| PR
    SL -->|GET/PUT config| PR
    PR --> SR
    SR --> AC
    SR --> CFG
    AC --> A88
```

### 文件清单（9 个文件）

| # | 文件 | 故事 | 类型 |
|---|------|------|------|
| 1 | `src/pages/SourcingToolPage.tsx` | US-1~8 | **新建** — 页面容器，编排子组件 |
| 2 | `src/components/sourcing/FileDropzone.tsx` | US-1 | **新建** — 多文件拖拽上传 |
| 3 | `src/components/sourcing/CostConfigForm.tsx` | US-4, US-7 | **新建** — 成本参数表单 |
| 4 | `src/components/sourcing/ProgressPanel.tsx` | US-2 | **新建** — SSE 进度面板 |
| 5 | `src/components/sourcing/ResultTable.tsx` | US-3, US-5 | **新建** — 结果表+可展开行 |
| 6 | `src/components/sourcing/SummaryBar.tsx` | US-6 | **新建** — 汇总统计条 |
| 7 | `src/components/sourcing/ExportButton.tsx` | US-8 | **新建** — 导出按钮 |
| 8 | `src/lib/sourcing.ts` | US-2, US-4, US-7 | **新建** — SSE 客户端 + config API 封装 |
| 9 | `src/data/software.ts` + `src/App.tsx` | US-9 | **修改** — 注册入口 |

### 关键设计决策

1. **SSE 消费方式**：用 `fetch() + ReadableStream` 而非 `EventSource`（POST 不支持 EventSource）。`src/lib/sourcing.ts` 封装 `analyzeStream()` 返回 `AsyncGenerator<SseEvent>`
2. **状态管理**：页面内用 `useReducer`，不引入全局 store。状态机：`idle → uploaded → analyzing → done | error`
3. **Excel 导出**：前端用 SheetJS (`xlsx` 库) 在前端生成，不依赖后端。汇总表 + 明细表双 Sheet
4. **多文件合并**：前端不合并，直接 FormData 传多个文件给后端。后端 `_read_files()` 负责合并并注入 `data_source` 标签
5. **组件通信**：页面级 state 通过 props 向下传递，回调函数向上冒泡。不跨组件共享状态

### 依赖

- `xlsx` (SheetJS) — 前端 Excel 导出，约 500KB gzip 后 ~120KB
- 无其他新增依赖。所有 UI 组件复用项目已有的 shadcn/ui + Tailwind v4

## 风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 1688 token 过期 (1.5h) | 中 | 中 | 后端有 `reset_session()`，前端加"刷新Session"按钮兜底 |
| SSE 代理缓冲 (Express pipe) | 低 | 中 | 已验证 proxyRes.pipe 支持流式，加 `X-Accel-Buffering: no` |
| 多文件列名不一致 | 中 | 中 | `_read_files` 逐文件校验，哪个文件有问题明确指出 |
| SheetJS 包体积 | 低 | 低 | 按需引入 `writeFile`，不计入首屏（懒加载导出按钮触达时 import） |

## Phase 3 审查检查清单

1. **API 路由规范**：`/api/shopee/sourcing/*`，与现有 shopee 代理一致
2. **文件命名规范**：组件 PascalCase，页面 `*Page.tsx`，库 `camelCase.ts`
3. **响应格式**：SSE 用 `event: xxx\ndata: json\n\n`；REST 用 FastAPI 默认 JSON；配置端点 `{config: {...}}`
4. **错误码体系**：HTTP 400/422/500，与 FastAPI 一致；前端 toast 显示 `detail` 字段
5. **TypeScript 严格度**：新建文件全部 `.tsx`/`.ts`，与项目一致
6. **测试策略**：本次不写单元测试（CLAUDE.md TDD 规则仅对"行为变更"强制执行，新页面属新增功能且用户未要求测试）。手动验收 9 个 US
7. **开发范式**：非 TDD（用户未要求，且为新页面独立开发不受既有测试约束）。直接实现 + 手动验收
8. **可观测性**：后端日志前缀 `[search]`/`[analyze]`/`[stream]`/`[config]`；前端 SSE 事件 console.log
9. **Git 策略**：全部组件完成后统一 commit，不走分批提交
10. **环境变量管理**：无需新增 env var。1688 配置在 YAML 中，已在 Phase 1 后端完成
11. **依赖版本兼容性**：`xlsx` 最新稳定版，确认与 Vite 8 + React 19 兼容
12. **代码格式化**：遵循项目现有的 Tailwind v4 原子类风格，不引入新格式化工具
