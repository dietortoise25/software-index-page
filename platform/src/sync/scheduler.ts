// qianyi-scheduler.service — 千易ERP 数据定时同步
import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import cron from "node-cron"
import { QianyiSDK } from "../sdk/index.js"
import { initSupabase, upsertBatch, getLastSyncAt, logSync } from "../sdk/sync.js"
import { syncAdCosts } from "./ad_sync.js"

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

async function syncOrders() {
  const module = "orders"
  console.log(`[${new Date().toISOString()}] 开始同步 ${module}...`)
  await logSync(module, "cron_pull", "running", 0)

  try {
    const lastSync = await getLastSyncAt(module)
    const timeFrom = lastSync
      ? new Date(lastSync).toISOString().replace("T", " ").substring(0, 19)
      : "2026-01-01 00:00:00"
    const timeTo = new Date().toISOString().replace("T", " ").substring(0, 19)

    let page = 1
    let totalSynced = 0

    while (true) {
      const result = await sdk.order.list({
        updateTimeFrom: timeFrom,
        updateTimeTo: timeTo,
        page,
        pageSize: PAGE_SIZE,
      }) as any

      const orders = result.result || []
      if (orders.length === 0) break

      const records = orders.map((o: any) => ({
        order_number: o.orderNumber,
        online_order_number: o.onlineOrderNumber,
        shop: o.shop,
        shop_id: o.shopId,
        platform: o.platform,
        site_code: o.siteCode,
        status: o.status,
        online_status: o.onlineStatus,
        warehouse: o.warehouse || null,
        wms_status: o.wmsStatus || null,
        currency: o.currency,
        total_amount: o.totalAmount,
        freight: o.freight,
        total_discount: o.totalDiscount,
        payment_method: o.paymentMethod,
        carrier: o.carrier || null,
        tracking_number: o.trackingNumber,
        pay_time: o.payTime ? new Date(o.payTime).toISOString() : null,
        create_time: o.createTime ? new Date(o.createTime).toISOString() : null,
        update_time: o.updateTime ? new Date(o.updateTime).toISOString() : null,
        shipping_time: o.shippingTime ? new Date(o.shippingTime).toISOString() : null,
        buyer: o.buyer || {},
        tag: o.tag || {},
        sku_list: o.skuList || [],
        odo_package_list: o.odoPackageVOList || [],
        raw_data: o,
        sync_source: "cron_pull",
        sync_at: new Date().toISOString(),
      }))

      totalSynced += await upsertBatch("orders", records, "order_number")
      if (orders.length < PAGE_SIZE) break
      page++
    }

    console.log(`[${module}] 同步完成: ${totalSynced} 条`)
    await logSync(module, "cron_pull", "success", totalSynced)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[${module}] 同步失败: ${msg}`)
    await logSync(module, "cron_pull", "failure", 0, msg)
  }
}

async function syncSkus() {
  const module = "skus"
  console.log(`[${new Date().toISOString()}] 开始同步 ${module}...`)
  await logSync(module, "cron_pull", "running", 0)

  try {
    let page = 1
    let totalSynced = 0

    while (true) {
      const result = await sdk.sku.list({ page, pageSize: PAGE_SIZE }) as any
      const skus = result.result || []
      if (skus.length === 0) break

      const records = skus.map((s: any) => ({
        sku: s.sku,
        title: s.title,
        barcode: s.barcode || null,
        type: s.type || "SINGLE",
        sale_status: s.saleStatus || null,
        weight: s.weight || null,
        weight_unit: s.weightUnit || null,
        category_name1: s.categoryName1 || null,
        category_name2: s.categoryName2 || null,
        category_name3: s.categoryName3 || null,
        enable: s.enable ?? 1,
        price: s.price || null,
        purchase_cost: s.purchaseCost || null,
        brand: s.brand || null,
        pic_url: s.picUrl || null,
        raw_data: s,
        sync_source: "cron_pull",
        sync_at: new Date().toISOString(),
      }))

      totalSynced += await upsertBatch("skus", records, "sku")
      if (skus.length < PAGE_SIZE) break
      page++
    }

    console.log(`[${module}] 同步完成: ${totalSynced} 条`)
    await logSync(module, "cron_pull", "success", totalSynced)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[${module}] 同步失败: ${msg}`)
    await logSync(module, "cron_pull", "failure", 0, msg)
  }
}

async function syncInventory() {
  const module = "inventory"
  console.log(`[${new Date().toISOString()}] 开始同步 ${module}...`)
  await logSync(module, "cron_pull", "running", 0)

  try {
    let page = 1
    let totalSynced = 0

    while (true) {
      const result = await sdk.inventory.listV2({ page, pageSize: PAGE_SIZE }) as any
      const items = result.result || result || []
      if (!Array.isArray(items) || items.length === 0) break

      const records = items.map((i: any) => ({
        sku: i.sku,
        sku_name: i.skuName || null,
        warehouse: i.warehouse,
        warehouse_code: i.warehouseCode || null,
        total: i.total ?? 0,
        available: i.available ?? 0,
        allocated: i.allocated ?? 0,
        unavailable: i.unavailable ?? 0,
        shipping_quantity: i.shippingQuantity ?? 0,
        total_cost: i.totalCost || null,
        raw_data: i,
        sync_at: new Date().toISOString(),
      }))

      totalSynced += records.length
      await upsertBatch("inventory_snapshots", records)
      if (items.length < PAGE_SIZE) break
      page++
    }

    console.log(`[${module}] 同步完成: ${totalSynced} 条`)
    await logSync(module, "cron_pull", "success", totalSynced)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[${module}] 同步失败: ${msg}`)
    await logSync(module, "cron_pull", "failure", 0, msg)
  }
}

console.log(`[调度器] 启动, 环境: ${APP_ENV}`)

cron.schedule("*/5 * * * *", syncOrders)
cron.schedule("*/30 * * * *", syncSkus)
cron.schedule("*/15 * * * *", syncInventory)
// 广告费用: 每天凌晨 2:00
cron.schedule("0 2 * * *", () => syncAdCosts(sdk, APP_ENV))

console.log("[调度器] 首次同步...")
syncOrders()
syncSkus()
syncInventory()
