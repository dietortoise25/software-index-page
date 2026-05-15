-- ===================== 内部管理 Schema =====================
CREATE SCHEMA IF NOT EXISTS internal;

-- ===================== 运营分组 =====================
CREATE TABLE IF NOT EXISTS internal.operator_groups (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name)
);
ALTER TABLE internal.operator_groups ENABLE ROW LEVEL SECURITY;

-- ===================== 运营人员 =====================
CREATE TABLE IF NOT EXISTS internal.operators (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  group_id BIGINT REFERENCES internal.operator_groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE internal.operators ENABLE ROW LEVEL SECURITY;

-- ===================== 店铺-运营者绑定 =====================
CREATE TABLE IF NOT EXISTS internal.shop_operators (
  id BIGSERIAL PRIMARY KEY,
  shop_id BIGINT NOT NULL,
  operator_id BIGINT NOT NULL REFERENCES internal.operators(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, operator_id)
);
CREATE INDEX IF NOT EXISTS idx_shop_operators_shop ON internal.shop_operators(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_operators_operator ON internal.shop_operators(operator_id);
ALTER TABLE internal.shop_operators ENABLE ROW LEVEL SECURITY;

-- ===================== 权限：允许 anon/authenticated 访问 internal schema =====================
GRANT USAGE ON SCHEMA internal TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA internal TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA internal TO anon, authenticated;

-- 未来新增对象也自动授权
ALTER DEFAULT PRIVILEGES IN SCHEMA internal GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA internal GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- RLS 策略
CREATE POLICY "Allow all" ON internal.operator_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON internal.operators FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON internal.shop_operators FOR ALL USING (true) WITH CHECK (true);
