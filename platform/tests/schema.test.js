import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, "../sql/001_create_tables.sql");
const sql = fs.readFileSync(sqlPath, "utf-8");

describe("SQL Schema 验证", () => {
  it("SQL 文件存在且非空", () => {
    assert.ok(fs.existsSync(sqlPath), "SQL 文件不存在");
    assert.ok(sql.length > 100, "SQL 文件内容过短");
  });

  const expectedTables = [
    "shops", "skus", "suppliers", "warehouses", "orders",
    "order_skus", "return_orders", "asns", "odos",
    "inventory_snapshots", "adjustments", "purchases", "sync_logs",
  ];

  for (const table of expectedTables) {
    it(`应该包含表: ${table}`, () => {
      const regex = new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${table}\\s*\\(`, "i");
      assert.match(sql, regex, `未找到表 ${table} 的建表语句`);
    });
  }

  it("所有表都应启用 RLS", () => {
    const rlsCount = (sql.match(/ENABLE ROW LEVEL SECURITY/g) || []).length;
    assert.ok(rlsCount >= 12, `RLS 启用数量不足: ${rlsCount}`);
  });

  it("sync_logs 表应该包含 module/status/records_count 字段", () => {
    assert.match(sql, /sync_logs[\s\S]*?module/i);
    assert.match(sql, /sync_logs[\s\S]*?status/i);
    assert.match(sql, /sync_logs[\s\S]*?records_count/i);
  });

  it("orders 表应该有 raw_data JSONB 列", () => {
    assert.match(sql, /orders[\s\S]*?raw_data\s+JSONB/i);
  });

  it("应该有 Allow all 的 RLS 策略", () => {
    assert.match(sql, /CREATE POLICY "Allow all"/i);
  });

  it("SQL 中没有 DROP 语句（安全校验）", () => {
    assert.doesNotMatch(sql, /\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i, "SQL 中存在危险的 DROP 语句");
  });

  it("关键索引应存在", () => {
    const requiredIndexes = [
      "idx_orders_shop_id",
      "idx_orders_status",
      "idx_orders_platform",
      "idx_orders_update_time",
      "idx_inventory_sku",
      "idx_inventory_warehouse",
      "idx_skus_type",
      "idx_shops_platform",
    ];
    for (const idx of requiredIndexes) {
      assert.match(sql, new RegExp(`CREATE INDEX.*${idx}`), `缺少索引: ${idx}`);
    }
  });

  it("inventory_snapshots 不应该有 UNIQUE 约束", () => {
    // 快照表是全量覆盖的，不应有唯一约束
    const inventorySection = sql.match(/CREATE TABLE IF NOT EXISTS inventory_snapshots[\s\S]*?(?=CREATE TABLE|$)/i)?.[0] || "";
    assert.doesNotMatch(inventorySection, /UNIQUE/i, "inventory_snapshots 不应有 UNIQUE 约束");
  });
});
