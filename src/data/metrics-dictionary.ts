/**
 * 看板指标数据字典
 * — 独立维护，不散落在组件中
 */
export interface MetricDef {
  key: string
  label: string
  tip: string
}

export const METRICS_DICT: Record<string, MetricDef> = {
  // ── 第1层：营收总览 ──
  todayCount: {
    key: "todayCount",
    label: "今日订单",
    tip: "今天（中国时区 Asia/Shanghai）付款的订单数量。只统计 pay_time 有值的订单，未付款的 CLOSED 单不计入。",
  },
  todaySales: {
    key: "todaySales",
    label: "今日销售额",
    tip: "今天付款订单的 total_amount 合计，币种为 BRL（巴西雷亚尔）。",
  },
  yesterdayCount: {
    key: "yesterdayCount",
    label: "昨日订单",
    tip: "昨天（中国时区）付款的订单数量。用于和今日做环比对比。",
  },
  yesterdaySales: {
    key: "yesterdaySales",
    label: "昨日销售额",
    tip: "昨天付款订单的 total_amount 合计。",
  },
  thisMonthCount: {
    key: "thisMonthCount",
    label: "本月订单",
    tip: "本月（从1号到今天）累计付款订单数。可能小于实际运营订单数，因为 CLOSED 状态的历史单没有 pay_time。",
  },
  thisMonthSales: {
    key: "thisMonthSales",
    label: "本月销售额",
    tip: "本月的 GMV（Gross Merchandise Volume），即所有付款订单的 total_amount 总和。",
  },
  lastMonthCount: {
    key: "lastMonthCount",
    label: "上月订单",
    tip: "上个月的付款订单总数。用于和本月做环比，计算增长率。",
  },
  lastMonthSales: {
    key: "lastMonthSales",
    label: "上月销售额",
    tip: "上个月的 GMV。本月 vs 上月的差额直接反映业务增长趋势。",
  },
  // ── 第2层：渠道分析 ──
  platformGmvPie: {
    key: "platformGmvPie",
    label: "平台 GMV 占比",
    tip: "近6个月 TikTok 和 Shopee 各自的 GMV 占比环形图。可以看出哪个平台是主力营收来源。GMV 是付款订单的 total_amount 合计。",
  },
  platformMonthlyBar: {
    key: "platformMonthlyBar",
    label: "平台销售额月对比",
    tip: "按月拆分 TikTok 和 Shopee 的 GMV 堆叠柱状图。可以观察两个渠道的增长趋势和季节性。",
  },
  // ── 第3层：运营者分析 ──
  operatorGmvRank: {
    key: "operatorGmvRank",
    label: "本月运营者 GMV Top 8",
    tip: "按本月 GMV 排行的运营者前8名。GMV 通过店铺绑定（shop_operators）关联到运营者，一个店铺多个运营者时各自计入。",
  },
  // ── 第4层：订单健康度 ──
  statusDist: {
    key: "statusDist",
    label: "订单状态分布",
    tip: "全部订单（不限时间）的状态分布环形图。CLOSED 占比高说明历史关单多，WAIT_PAYMENT/WAIT_AUDIT 占比高说明待处理订单积压。",
  },
  healthMetrics: {
    key: "healthMetrics",
    label: "健康指标",
    tip: "已关闭订单占比过高可能说明退货/取消率高；待发货/待审核堆积说明运营处理不及时。",
  },
  // ── 第5层：广告费用 ──
  adSpend: {
    key: "adSpend",
    label: "本月广告支出",
    tip: "当月从平台报表汇总的全部广告相关扣费（取绝对值）。来源：TikTok 的达人佣金、联盟广告费 + Shopee 的 AMS 佣金、广告托管费。数据每天凌晨 2:00 自动同步。",
  },
  adRate: {
    key: "adRate",
    label: "广告费用率",
    tip: "广告支出 ÷ 同期 GMV × 100%。健康 <15%（绿），15-25% 需要关注（黄），>25% 告警（红）。费率越高，每赚 1 块钱付出的广告成本越大。",
  },
  affiliatePct: {
    key: "affiliatePct",
    label: "达人佣金占比",
    tip: "达人佣金（含联盟广告佣金）占广告总支出的比例。TikTok 场景下越高代表越依赖达人带货模式，Shopee 此指标通常接近 0。",
  },
  adMonths: {
    key: "adMonths",
    label: "数据月份",
    tip: "已有广告费用数据的月份数。系统刚开始同步报表数据，时间越长趋势分析越有意义。",
  },
  adPlatformBar: {
    key: "adPlatformBar",
    label: "平台广告支出",
    tip: "按月拆分的 TikTok 和 Shopee 广告支出堆叠柱状图。能看出不同平台的广告成本结构和变化趋势。",
  },
  adRateTrend: {
    key: "adRateTrend",
    label: "广告费用率趋势",
    tip: "每月广告费用率的折线图。15% 是行业参考健康线，超过需要关注是否投放效率下降或成本上升。",
  },
}
