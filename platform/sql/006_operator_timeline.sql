-- ===== 运营负责人时间线 =====

-- 1. operators 加飞书 open_id
ALTER TABLE internal.operators ADD COLUMN IF NOT EXISTS feishu_open_id VARCHAR(100);

-- 2. shop_operators 加时间线和主负责人
ALTER TABLE internal.shop_operators ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
ALTER TABLE internal.shop_operators ADD COLUMN IF NOT EXISTS effective_from DATE;
ALTER TABLE internal.shop_operators ADD COLUMN IF NOT EXISTS effective_to DATE;

-- 3. 变动记录表
CREATE TABLE IF NOT EXISTS internal.shop_operator_changes (
  id BIGSERIAL PRIMARY KEY,
  shop_id BIGINT NOT NULL,
  operator_id BIGINT NOT NULL,
  change_type VARCHAR(20) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  reason TEXT NOT NULL,
  submitted_by VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  instance_code VARCHAR(100),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

ALTER TABLE internal.shop_operator_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON internal.shop_operator_changes FOR ALL USING (true) WITH CHECK (true);
