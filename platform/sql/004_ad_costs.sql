-- ===================== 广告费用汇总表 =====================
CREATE TABLE IF NOT EXISTS public.ad_costs (
  id BIGSERIAL PRIMARY KEY,
  platform VARCHAR(20) NOT NULL,
  report_month VARCHAR(7) NOT NULL,          -- YYYY-MM
  affiliate_cost DECIMAL(18,4) DEFAULT 0,    -- 达人/联盟佣金合计
  tech_ad_cost DECIMAL(18,4) DEFAULT 0,      -- 技术服务/广告托管费
  total_cost DECIMAL(18,4) DEFAULT 0,        -- 广告总支出
  raw_data JSONB DEFAULT '{}',
  sync_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, report_month)
);
ALTER TABLE public.ad_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.ad_costs FOR ALL USING (true) WITH CHECK (true);
