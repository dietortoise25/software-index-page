# TikTok Shop API 业务场景覆盖矩阵

> 来源：TikTok Shop Partner Center 官方文档  
> 日期：2026-05-21

## 图例

| 符号 | 含义 |
|------|------|
| ✓ | 支持 |
| ✗ | 不支持 |
| – | 不适用 |

---

## L1 分类总览

| L1 | 中文 | 场景数 |
|----|------|--------|
| eCommerce Management | 电子商务管理 | 5 |
| Merchandising | 商品营销 | 2 |
| Shipping & Fulfillment | 发货与履约 | 4 |
| Customer Engagement | 客户互动 | 6 |
| Finance | 财务 | 2 |
| Catalog | 目录 | 3 |
| Marketing | 营销 | 3 |
| Global Selling | 全球销售 | 1 |
| Seller in-house developer | 卖家内部开发者 | 1 |

---

## 详细矩阵

### eCommerce Management / 电子商务管理

| L2 | 中文 | 业务场景 | Product | Order | Fulfillment | Finance | After-sales | Customer Service | Marketing | Affiliate | Content/LIVE | Analytics |
|----|------|---------|---------|-------|-------------|---------|-------------|------------------|----------|-----------|-------------|-----------|
| Connectors | 连接器 | 连接商店前端系统并同步运营数据 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ |
| Enterprise Resource Planning | 企业资源规划 | 集成 ERP 以统一运营工作流程 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ |
| Multi-Channel Management | 多渠道管理 | 跨渠道集中管理产品和履行 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ |
| Print On Demand | 按需印刷 | 按订单生产和交付定制产品 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Dropshipping | 一件代发 | 连接供应商并完成代发货履行 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

### Merchandising / 商品营销

| L2 | 中文 | 业务场景 | Product | Order | Fulfillment | Finance | After-sales | Customer Service | Marketing | Affiliate | Content/LIVE | Analytics |
|----|------|---------|---------|-------|-------------|---------|-------------|------------------|----------|-----------|-------------|-----------|
| Product Design & Sourcing | 产品设计与采购 | 连接设计、打样和采购工作流程 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Optimization | 优化 | 优化商品标题、图片和列表质量 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ |

### Shipping & Fulfillment / 发货与履约

| L2 | 中文 | 业务场景 | Product | Order | Fulfillment | Finance | After-sales | Customer Service | Marketing | Affiliate | Content/LIVE | Analytics |
|----|------|---------|---------|-------|-------------|---------|-------------|------------------|----------|-----------|-------------|-----------|
| Fulfilled by TikTok (FBT) | 由 TikTok 履行 | 管理与官方 FBT 系统相关的工作流程 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Order Management (OMS/WMS) | 订单管理 | 通过 OMS/WMS 系统同步配送状态 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Shipping | 配送 | 管理仓库配送和物流回调 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Returns | 退货 | 管理退货、退款和换货流程 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

### Customer Engagement / 客户互动

| L2 | 中文 | 业务场景 | Product | Order | Fulfillment | Finance | After-sales | Customer Service | Marketing | Affiliate | Content/LIVE | Analytics |
|----|------|---------|---------|-------|-------------|---------|-------------|------------------|----------|-----------|-------------|-----------|
| Shoppable Content | 可购物内容 | 在内容中标记产品并跟踪转化 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Promotions | 促销 | 创建和管理促销活动 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Customer Reviews | 客户评价 | 分析评价反馈并运行声誉管理计划 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Affiliate | 联盟 | 管理创作者合作与联盟订单 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Loyalty & Rewards | 忠诚度与奖励 | 运行会员奖励和复购计划 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| LIVE Shopping | 直播购物 | 支持直播电商互动和订单流程 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

### Finance / 财务

| L2 | 中文 | 业务场景 | Product | Order | Fulfillment | Finance | After-sales | Customer Service | Marketing | Affiliate | Content/LIVE | Analytics |
|----|------|---------|---------|-------|-------------|---------|-------------|------------------|----------|-----------|-------------|-----------|
| Finance | 财务 | 获取交易结算和现金流数据 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Accounting | 会计 | 提取账单/订单详情以进行精细对账 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

### Catalog / 目录

| L2 | 中文 | 业务场景 | Product | Order | Fulfillment | Finance | After-sales | Customer Service | Marketing | Affiliate | Content/LIVE | Analytics |
|----|------|---------|---------|-------|-------------|---------|-------------|------------------|----------|-----------|-------------|-----------|
| Product Listing | 产品列表 | 映射产品并持续同步列表信息 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ |
| Product Information Management | 产品信息管理 | 维护产品标题、属性和图片 | – | – | – | – | – | – | – | – | – | – |
| Digital Asset Management | 数字资产管理 | 管理产品图片、视频和其他媒体资产 | – | – | – | – | – | – | – | – | – | – |

### Marketing / 营销

| L2 | 中文 | 业务场景 | Product | Order | Fulfillment | Finance | After-sales | Customer Service | Marketing | Affiliate | Content/LIVE | Analytics |
|----|------|---------|---------|-------|-------------|---------|-------------|------------------|----------|-----------|-------------|-----------|
| Ads | 广告 | 丰富跟踪标识并支持广告归因 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| CRM | 客户关系管理 | 细分客户并进行定向推广 | – | – | – | – | – | – | – | – | – | – |
| Analytics & Reporting | 分析与报告 | 跟踪运营关键绩效指标并运行分析审查 | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ |

### Global Selling / 全球销售

| L2 | 中文 | 业务场景 | Product | Order | Fulfillment | Finance | After-sales | Customer Service | Marketing | Affiliate | Content/LIVE | Analytics |
|----|------|---------|---------|-------|-------------|---------|-------------|------------------|----------|-----------|-------------|-----------|
| Full Service | 全托管服务 | 服务于全托管或全面的跨市场运营 | ✓ | – | – | – | – | – | – | – | – | – |

### Seller in-house developer / 卖家内部开发者

| L2 | 中文 | 业务场景 | Product | Order | Fulfillment | Finance | After-sales | Customer Service | Marketing | Affiliate | Content/LIVE | Analytics |
|----|------|---------|---------|-------|-------------|---------|-------------|------------------|----------|-----------|-------------|-----------|
| TikTok Shop Seller | TikTok Shop 卖家 | 端到端管理您自己店铺的产品、订单和运营 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 业务域 API 覆盖速查

| 业务域 | API 覆盖场景数 | 关键能力 |
|--------|---------------|---------|
| **Product** (产品) | 24/26 | 最广泛支持，几乎所有场景覆盖 |
| **Order** (订单) | 24/26 | 与 Product 同等覆盖 |
| **Fulfillment** (履行) | 24/26 | 全场景覆盖 |
| **Finance** (财务) | 24/26 | 含结算、对账 |
| **After-sales** (售后) | 24/26 | 退货、退款、换货 |
| **Customer Service** (客服) | 2/26 | 仅 Connectors 和 Seller 支持 |
| **Marketing** (营销) | 6/26 | 主要覆盖在 Affiliate、Seller、Optimization 场景 |
| **Affiliate** (联盟) | 4/26 | 联盟 + 内容/直播场景 |
| **Content / LIVE** (内容/直播) | 4/26 | 购物内容 + 直播场景 |
| **Analytics** (数据分析) | 10/26 | ERP、多渠道、优化、卖家等场景支持 |

---

## 与经营 Copilot 的关联

| 业务域 | 我们的需要 | API 状态 |
|--------|-----------|---------|
| Order | 订单看板、GMV 统计 | ✓ `platform/src/tiktok-shop/` |
| Product | SKU 排行、库存监控 | ✓ |
| Fulfillment | 库存天数预警 | ✓ |
| Finance | 利润计算、广告 ROI | ✓ |
| Ads (Marketing) | CPM/CTR/CVR 数据 | ⚠️ 待确认 API 端点 |
| Analytics | 趋势分析、报表 | ✓ |
| Affiliate | 达人佣金数据 | ⚠️ 已通过千易ERP获取 |

---

## 注册建议

**一步到位**：Partner Center 注册时选择 **TikTok Shop Seller** 角色。

理由：该角色对 Product / Order / Fulfillment / Finance / After-sales / Customer Service / Marketing / Affiliate / Content / Analytics 全部 ✓，一次性覆盖经营 Copilot 所有数据需求。

---

## 经营 Copilot 所需业务场景

### 核心管线（必选）

| 场景 | 为什么需要 | 对应 Copilot 模块 |
|------|-----------|-----------------|
| **Analytics & Reporting**（分析与报告） | GMV/ROI/利润率/CPM 指标，事件检测引擎的核心输入 | 事件检测引擎 + 日报生成 |
| **Order Management（OMS/WMS）**（订单管理） | 订单状态分布、退货率、按平台/运营者聚合 | 订单健康度看板 |
| **Finance**（财务） | 结算数据、毛利率计算、广告费用率 | 利润异常检测 |
| **Ads**（广告） | CPM/CTR/CVR 原始数据，ROI 异常检测关键输入 | ROI/广告异常检测 |
| **Product Listing**（产品列表） | SKU 级数据：库存天数、利润贡献排行 | 库存预警 + SKU 排行 |

### 锦上添花（可选）

| 场景 | 说明 |
|------|------|
| **Shipping**（配送） | 物流状态上下文，库存预警补充 |
| **Returns**（退货） | 退款异常检测 |
| **Affiliate**（联盟） | 达人佣金原始数据（已有千易 ERP 覆盖，API 直连更实时） |

### 不需要申请的

| 场景 | 原因 |
|------|------|
| Customer Service | 不走 API，仍用 TF 客服值守插件 |
| CRM | 暂无需求 |
| Print On Demand / Dropshipping | 业务模式不匹配 |
| LIVE Shopping | 暂无直播业务 |
| Digital Asset Management | 不适用 |
