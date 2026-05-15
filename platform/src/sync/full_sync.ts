import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import { QianyiSDK } from "../sdk/index.js"
import { initSupabase, upsertBatch, logSync } from "../sdk/sync.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, "../../.env") })

const APP_ENV = process.env.API_ENV || "production_asia"
const BASE_URL = `https://${process.env[`${APP_ENV.toUpperCase()}_URL`]}`
const APP_ID = process.env[`${APP_ENV.toUpperCase()}_APP_ID`]!
const APP_SECRET = process.env[`${APP_ENV.toUpperCase()}_APP_SECRET`]!

initSupabase({
  url: process.env.SUPABASE_URL!,
  anonKey: process.env.SUPABASE_ANON_KEY!,
})

const sdk = new QianyiSDK({ baseUrl: BASE_URL, appId: APP_ID, appSecret: APP_SECRET })
const PAGE_SIZE = 200

type FetchFn = (page: number) => Promise<{ result?: unknown[]; total?: number }>
type MapFn = (item: any) => Record<string, unknown>

async function syncAll(table: string, fetchFn: FetchFn, mapFn: MapFn, conflictKey?: string) {
  console.log(`\n[${table}] 开始全量同步...`)
  await logSync(table, "full_sync", "running", 0)
  const start = Date.now()

  try {
    let page = 1
    let total = 0

    while (true) {
      const result = await fetchFn(page)
      const items = (result as any)?.result || result || []
      if (!Array.isArray(items) || items.length === 0) break

      const records = items.map(mapFn)
      const count = await upsertBatch(table, records, conflictKey)
      total += count

      const pct = (result as any)?.total ? ((page * PAGE_SIZE / (result as any).total) * 100).toFixed(0) : "?"
      process.stdout.write(`  第${page}页: ${count}条 | 累计 ${total} / ${(result as any)?.total ?? "?"} (${pct}%)\r`)

      if (items.length < PAGE_SIZE) break
      page++
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`\n  ✅ 完成: ${total} 条, 耗时 ${elapsed}s`)
    await logSync(table, "full_sync", "success", total)
    return total
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`\n  ❌ 失败: ${msg}`)
    await logSync(table, "full_sync", "failure", 0, msg)
    return 0
  }
}

console.log(`全量同步开始 | 环境: ${APP_ENV} | ${BASE_URL}`)
console.log("=".repeat(50))

let grandTotal = 0

grandTotal += await syncAll(
  "warehouses",
  (page) => sdk.warehouse.list({ page, pageSize: PAGE_SIZE }) as any,
  (w: any) => ({
    warehouse_id: w.id, name: w.name, kind: w.kind, provider_name: w.providerName,
    code: w.code, country: w.country, timezone_id: w.timezoneId, status: w.status,
    raw_data: w, sync_at: new Date().toISOString(),
  }),
  "warehouse_id",
)

grandTotal += await syncAll(
  "shops",
  (page) => sdk.shop.list({ page, pageSize: PAGE_SIZE }) as any,
  (s: any) => ({
    shop_id: s.shopId, name: s.name, platform: s.platform, status: s.status,
    site_code: s.siteCode || null, online_shop_id: s.onlineShopId || null,
    auth_expired_status: s.authExpiredStatus, create_time: s.createTime ? new Date(s.createTime).toISOString() : null,
    shop_group_list: s.shopGroupVOList || [], raw_data: s,
    sync_source: "full_sync", sync_at: new Date().toISOString(),
  }),
  "shop_id",
)

grandTotal += await syncAll(
  "skus",
  (page) => sdk.sku.list({ page, pageSize: PAGE_SIZE }) as any,
  (s: any) => ({
    sku: s.sku, title: s.title, barcode: s.barcode || null, type: s.type || "SINGLE",
    sale_status: s.saleStatus || null, weight: s.weight || null, weight_unit: s.weightUnit || null,
    category_name1: s.categoryName1 || null, category_name2: s.categoryName2 || null,
    category_name3: s.categoryName3 || null, enable: s.enable ?? 1,
    price: s.price || null, purchase_cost: s.purchaseCost || null,
    brand: s.brand || null, pic_url: s.picUrl || null,
    raw_data: s, sync_source: "full_sync", sync_at: new Date().toISOString(),
  }),
  "sku",
)

grandTotal += await syncAll(
  "suppliers",
  (page) => sdk.supplier.list({ page, pageSize: PAGE_SIZE }) as any,
  (s: any) => ({
    name: s.name, category: s.category, level: s.level,
    purchaser_user_name: s.purchaserUserName, settlement_way: s.settlementWay,
    payment_way: s.paymentWay, enable: s.enable, country: s.country,
    raw_data: s, sync_source: "full_sync", sync_at: new Date().toISOString(),
  }),
  "name",
)

grandTotal += await syncAll(
  "inventory_snapshots",
  (page) => sdk.inventory.listV2({ page, pageSize: PAGE_SIZE }) as any,
  (i: any) => ({
    sku: i.sku, sku_name: i.skuName || null,
    warehouse: i.warehouse, warehouse_code: i.warehouseCode || null,
    total: i.total ?? 0, available: i.available ?? 0, allocated: i.allocated ?? 0,
    unavailable: i.unavailable ?? 0, shipping_quantity: i.shippingQuantity ?? 0,
    total_cost: i.totalCost || null, raw_data: i, sync_at: new Date().toISOString(),
  }),
)

const toNow = new Date().toISOString().replace("T", " ").substring(0, 19)
const from30d = new Date(Date.now() - 30 * 86400000).toISOString().replace("T", " ").substring(0, 19)
grandTotal += await syncAll(
  "orders",
  (page) => sdk.order.list({ updateTimeFrom: from30d, updateTimeTo: toNow, page, pageSize: PAGE_SIZE }) as any,
  (o: any) => ({
    order_number: o.orderNumber, online_order_number: o.onlineOrderNumber,
    shop: o.shop, shop_id: o.shopId, platform: o.platform, site_code: o.siteCode,
    status: o.status, online_status: o.onlineStatus,
    warehouse: o.warehouse || null, wms_status: o.wmsStatus || null,
    currency: o.currency, total_amount: o.totalAmount, freight: o.freight,
    total_discount: o.totalDiscount, payment_method: o.paymentMethod,
    carrier: o.carrier || null, tracking_number: o.trackingNumber,
    pay_time: o.payTime ? new Date(o.payTime).toISOString() : null,
    create_time: o.createTime ? new Date(o.createTime).toISOString() : null,
    update_time: o.updateTime ? new Date(o.updateTime).toISOString() : null,
    shipping_time: o.shippingTime ? new Date(o.shippingTime).toISOString() : null,
    buyer: o.buyer || {}, tag: o.tag || {},
    sku_list: o.skuList || [], odo_package_list: o.odoPackageVOList || [],
    raw_data: o, sync_source: "full_sync", sync_at: new Date().toISOString(),
  }),
  "order_number",
)

console.log("\n" + "=".repeat(50))
console.log(`全量同步结束, 总计写入 ${grandTotal} 条记录`)
