# Agent Test 页面 Tab 化改造

## 概述

将 `/agent-test` 单页改造为 Tab 多子应用布局，Demo-0 为当前 Agent，其余为开发中占位。AI 消息附带 Claude 风格的元数据行。

## Tab 结构

| Tab | 内容 | 状态 |
|-----|------|------|
| Demo-0 | 当前 Agent 基座（聊天 + 工具调用 + 会话持久化） | 功能完整 |
| 线性工作流 | createAgent 替换手写 tool loop | 开发中 |
| 分支路由 | StateGraph + 意图分类 + 多 Agent 分支 | 开发中 |
| Supervisor | createSupervisor 多 Agent 协作 | 开发中 |
| Swarm | Agent 自主握手传递 | 开发中 |

## UI 布局

- 顶部 Tab 栏切换子应用
- 左侧聊天区（70%）
- 右侧会话列表（30%）
- 空状态显示里程碑卡片
- AI 消息下方一行小字：`🛠 tool_name · N tokens · thinking ✓`

## 后端改动

- SSE 流结束前发送元数据事件：`{ type: "metadata", toolCalls: [...], tokens: {...}, thinkingEnabled: true }`
- 预检阶段收集 toolCalls 和 token 信息

## 开发中 Tab

- 居中卡片：名称 + 描述 + 技术栈标签 + 开发中徽章
- 技术栈标签：LangGraph、Supervisor、Swarm 等
