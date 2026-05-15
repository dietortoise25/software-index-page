-- ===================== 店铺 =====================
CREATE TABLE IF NOT EXISTS shops (
  id BIGSERIAL PRIMARY KEY,
  shop_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  platform VARCHAR(50),
  status VARCHAR(20) DEFAULT 'UNLOCK',
  site_code VARCHAR(10),
  online_shop_id VARCHAR(50),
  auth_expired_status VARCHAR(20),
  create_time TIMESTAMPTZ,
  shop_group_list JSONB DEFAULT '[]',
  raw_data JSONB NOT NULL DEFAULT '{}',
  sync_source VARCHAR(20) NOT NULL DEFAULT 'cron_pull',
  sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id)
);
CREATE INDEX IF NOT EXISTS idx_shops_platform ON shops(platform);
CREATE INDEX IF NOT EXISTS idx_shops_status ON shops(status);
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- ===================== 商品 =====================
CREATE TABLE IF NOT EXISTS skus (
  id BIGSERIAL PRIMARY KEY,
  sku VARCHAR(100) NOT NULL,
  title VARCHAR(500),
  barcode VARCHAR(100),
  type VARCHAR(20) DEFAULT 'SINGLE',
  sale_status VARCHAR(20),
  weight DECIMAL(18,4),
  weight_unit VARCHAR(10),
  category_name1 VARCHAR(100),
  category_name2 VARCHAR(100),
  category_name3 VARCHAR(100),
  enable SMALLINT DEFAULT 1,
  price DECIMAL(18,4),
  purchase_cost DECIMAL(18,4),
  brand VARCHAR(100),
  pic_url TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}',
  sync_source VARCHAR(20) NOT NULL DEFAULT 'cron_pull',
  sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sku)
);
CREATE INDEX IF NOT EXISTS idx_skus_type ON skus(type);
CREATE INDEX IF NOT EXISTS idx_skus_enable ON skus(enable);
ALTER TABLE skus ENABLE ROW LEVEL SECURITY;

-- ===================== 供应商 =====================
CREATE TABLE IF NOT EXISTS suppliers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50),
  level VARCHAR(5),
  purchaser_user_name VARCHAR(100),
  settlement_way VARCHAR(50),
  payment_way VARCHAR(50),
  enable BOOLEAN DEFAULT TRUE,
  country VARCHAR(10),
  raw_data JSONB NOT NULL DEFAULT '{}',
  sync_source VARCHAR(20) NOT NULL DEFAULT 'cron_pull',
  sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_category ON suppliers(category);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- ===================== 仓库 =====================
CREATE TABLE IF NOT EXISTS warehouses (
  id BIGSERIAL PRIMARY KEY,
  warehouse_id BIGINT NOT NULL,
  name VARCHAR(200) NOT NULL,
  kind VARCHAR(20),
  provider_name VARCHAR(100),
  code VARCHAR(50),
  country VARCHAR(10),
  timezone_id VARCHAR(50),
  status VARCHAR(20) DEFAULT 'UNLOCK',
  raw_data JSONB NOT NULL DEFAULT '{}',
  sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(warehouse_id)
);
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

-- ===================== 订单 =====================
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL,
  online_order_number VARCHAR(50),
  shop VARCHAR(200),
  shop_id BIGINT,
  platform VARCHAR(50),
  site_code VARCHAR(10),
  status VARCHAR(30),
  online_status VARCHAR(30),
  warehouse VARCHAR(200),
  wms_status VARCHAR(30),
  currency VARCHAR(10),
  total_amount DECIMAL(18,4),
  freight DECIMAL(18,4),
  total_discount DECIMAL(18,4),
  payment_method VARCHAR(20),
  carrier VARCHAR(100),
  tracking_number VARCHAR(100),
  pay_time TIMESTAMPTZ,
  create_time TIMESTAMPTZ,
  update_time TIMESTAMPTZ,
  shipping_time TIMESTAMPTZ,
  buyer JSONB,
  tag JSONB DEFAULT '{}',
  sku_list JSONB NOT NULL DEFAULT '[]',
  odo_package_list JSONB DEFAULT '[]',
  custom_field_list JSONB DEFAULT '[]',
  raw_data JSONB NOT NULL DEFAULT '{}',
  sync_source VARCHAR(20) NOT NULL DEFAULT 'cron_pull',
  sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_number)
);
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_platform ON orders(platform);
CREATE INDEX IF NOT EXISTS idx_orders_pay_time ON orders(pay_time);
CREATE INDEX IF NOT EXISTS idx_orders_update_time ON orders(update_time);
CREATE INDEX IF NOT EXISTS idx_orders_online_order_number ON orders(online_order_number);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ===================== 订单商品行 =====================
CREATE TABLE IF NOT EXISTS order_skus (
  id BIGSERIAL PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL REFERENCES orders(order_number) ON DELETE CASCADE,
  order_sku_id BIGINT,
  sku VARCHAR(100),
  quantity INTEGER DEFAULT 1,
  pay_amount DECIMAL(18,4),
  payment_price DECIMAL(18,4),
  original_price DECIMAL(18,4),
  shipping_price DECIMAL(18,4),
  promotion_discount DECIMAL(18,4),
  platform_discount DECIMAL(18,4),
  total_discount DECIMAL(18,4),
  total_tax DECIMAL(18,4),
  online_item_id VARCHAR(100),
  online_product_code VARCHAR(100),
  online_product_title VARCHAR(500),
  sub_sku_list JSONB DEFAULT '[]',
  tag JSONB DEFAULT '{}',
  raw_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_skus_order_number ON order_skus(order_number);
CREATE INDEX IF NOT EXISTS idx_order_skus_sku ON order_skus(sku);
ALTER TABLE order_skus ENABLE ROW LEVEL SECURITY;

-- ===================== 售后/退货单 =====================
CREATE TABLE IF NOT EXISTS return_orders (
  id BIGSERIAL PRIMARY KEY,
  return_number VARCHAR(50) NOT NULL,
  order_number VARCHAR(50),
  online_order_number VARCHAR(50),
  shop VARCHAR(200),
  warehouse VARCHAR(200),
  status VARCHAR(30),
  type VARCHAR(30),
  currency VARCHAR(10),
  total_amount DECIMAL(18,4),
  reason TEXT,
  carrier VARCHAR(100),
  custom_number VARCHAR(100),
  create_time TIMESTAMPTZ,
  update_time TIMESTAMPTZ,
  finish_time TIMESTAMPTZ,
  return_sku_list JSONB DEFAULT '[]',
  raw_data JSONB NOT NULL DEFAULT '{}',
  sync_source VARCHAR(20) NOT NULL DEFAULT 'cron_pull',
  sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(return_number)
);
CREATE INDEX IF NOT EXISTS idx_return_orders_order_number ON return_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_return_orders_status ON return_orders(status);
ALTER TABLE return_orders ENABLE ROW LEVEL SECURITY;

-- ===================== 入库单 =====================
CREATE TABLE IF NOT EXISTS asns (
  id BIGSERIAL PRIMARY KEY,
  asn_number VARCHAR(50) NOT NULL,
  business_number VARCHAR(100),
  custom_number VARCHAR(100),
  track_number VARCHAR(100),
  warehouse_name VARCHAR(200),
  type VARCHAR(50),
  status VARCHAR(30),
  create_time TIMESTAMPTZ,
  stock_in_time TIMESTAMPTZ,
  finish_time TIMESTAMPTZ,
  sku_list JSONB DEFAULT '[]',
  raw_data JSONB NOT NULL DEFAULT '{}',
  sync_source VARCHAR(20) NOT NULL DEFAULT 'cron_pull',
  sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(asn_number)
);
CREATE INDEX IF NOT EXISTS idx_asns_status ON asns(status);
CREATE INDEX IF NOT EXISTS idx_asns_warehouse ON asns(warehouse_name);
ALTER TABLE asns ENABLE ROW LEVEL SECURITY;

-- ===================== 出库单 =====================
CREATE TABLE IF NOT EXISTS odos (
  id BIGSERIAL PRIMARY KEY,
  odo_number VARCHAR(50) NOT NULL,
  custom_number VARCHAR(100),
  track_number VARCHAR(100),
  warehouse_name VARCHAR(200),
  type VARCHAR(50),
  status VARCHAR(30),
  create_time TIMESTAMPTZ,
  finish_time TIMESTAMPTZ,
  order_number_list JSONB DEFAULT '[]',
  sku_list JSONB DEFAULT '[]',
  package_list JSONB DEFAULT '[]',
  raw_data JSONB NOT NULL DEFAULT '{}',
  sync_source VARCHAR(20) NOT NULL DEFAULT 'cron_pull',
  sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(odo_number)
);
CREATE INDEX IF NOT EXISTS idx_odos_status ON odos(status);
CREATE INDEX IF NOT EXISTS idx_odos_warehouse ON odos(warehouse_name);
ALTER TABLE odos ENABLE ROW LEVEL SECURITY;

-- ===================== 库存快照 =====================
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id BIGSERIAL PRIMARY KEY,
  sku VARCHAR(100) NOT NULL,
  sku_name VARCHAR(500),
  warehouse VARCHAR(200) NOT NULL,
  warehouse_code VARCHAR(50),
  total INTEGER DEFAULT 0,
  available INTEGER DEFAULT 0,
  allocated INTEGER DEFAULT 0,
  unavailable INTEGER DEFAULT 0,
  shipping_quantity INTEGER DEFAULT 0,
  total_cost DECIMAL(18,4),
  raw_data JSONB NOT NULL DEFAULT '{}',
  sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory_snapshots(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory_snapshots(warehouse);
CREATE INDEX IF NOT EXISTS idx_inventory_sync_at ON inventory_snapshots(sync_at);
ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;

-- ===================== 调整单 =====================
CREATE TABLE IF NOT EXISTS adjustments (
  id BIGSERIAL PRIMARY KEY,
  adjustment_number VARCHAR(50) NOT NULL,
  source VARCHAR(20),
  auto_source VARCHAR(50),
  warehouse_name VARCHAR(200),
  create_time TIMESTAMPTZ,
  sku_list JSONB DEFAULT '[]',
  raw_data JSONB NOT NULL DEFAULT '{}',
  sync_source VARCHAR(20) NOT NULL DEFAULT 'cron_pull',
  sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(adjustment_number)
);
ALTER TABLE adjustments ENABLE ROW LEVEL SECURITY;

-- ===================== 采购单 =====================
CREATE TABLE IF NOT EXISTS purchases (
  id BIGSERIAL PRIMARY KEY,
  purchase_number VARCHAR(50) NOT NULL,
  custom_number VARCHAR(100),
  warehouse_name VARCHAR(200),
  supplier_name VARCHAR(200),
  purchase_type VARCHAR(30),
  status VARCHAR(30),
  settlement_type VARCHAR(50),
  payment_type VARCHAR(30),
  purchase_price_unit VARCHAR(10),
  shipping_cost DECIMAL(18,4),
  create_time TIMESTAMPTZ,
  order_time TIMESTAMPTZ,
  sku_list JSONB DEFAULT '[]',
  raw_data JSONB NOT NULL DEFAULT '{}',
  sync_source VARCHAR(20) NOT NULL DEFAULT 'cron_pull',
  sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(purchase_number)
);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- ===================== 同步日志 =====================
CREATE TABLE IF NOT EXISTS sync_logs (
  id BIGSERIAL PRIMARY KEY,
  module VARCHAR(50) NOT NULL,
  source VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  records_count INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sync_logs_module ON sync_logs(module);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at);
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- ===================== RLS 策略（允许 anon 访问） =====================
-- 注意: 生产环境应改为更严格的策略
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY['shops','skus','suppliers','warehouses','orders','order_skus',
                        'return_orders','asns','odos','inventory_snapshots','adjustments',
                        'purchases','sync_logs'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow all" ON %I', tbl);
    EXECUTE format('CREATE POLICY "Allow all" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END $$;
