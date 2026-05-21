-- ===================== 广告费用明细表（保留原始粒度） =====================
CREATE TABLE IF NOT EXISTS public.ad_cost_details (
  id BIGSERIAL PRIMARY KEY,
  platform VARCHAR(20) NOT NULL,
  shop_id BIGINT,
  shop_name VARCHAR(200),
  settlement_date DATE NOT NULL,        -- 精确到天
  order_id VARCHAR(50),
  affiliate_cost DECIMAL(18,4) DEFAULT 0,
  tech_ad_cost DECIMAL(18,4) DEFAULT 0,
  total_cost DECIMAL(18,4) DEFAULT 0,
  raw_data JSONB DEFAULT '{}',
  sync_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, order_id, settlement_date)
);
CREATE INDEX IF NOT EXISTS idx_ad_cost_details_date ON public.ad_cost_details(settlement_date);
CREATE INDEX IF NOT EXISTS idx_ad_cost_details_shop ON public.ad_cost_details(shop_id);
ALTER TABLE public.ad_cost_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.ad_cost_details FOR ALL USING (true) WITH CHECK (true);
