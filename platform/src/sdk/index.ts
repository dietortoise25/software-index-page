import { QianyiClient } from "./client.js"
import { createShopModule } from "./modules/shop.js"
import { createSkuModule } from "./modules/sku.js"
import { createOrderModule } from "./modules/order.js"
import { createReturnOrderModule } from "./modules/returnOrder.js"
import { createWarehouseModule } from "./modules/warehouse.js"
import { createInventoryModule } from "./modules/inventory.js"
import { createAsnModule } from "./modules/asn.js"
import { createOdoModule } from "./modules/odo.js"
import { createAdjustmentModule } from "./modules/adjustment.js"
import { createPurchaseModule } from "./modules/purchase.js"
import { createLogisticsModule } from "./modules/logistics.js"
import { createReportModule } from "./modules/report.js"
import { createCustomFieldModule } from "./modules/customField.js"
import { createSupplierModule } from "./modules/supplier.js"

export { QianyiError, QianyiClient } from "./client.js"
export type { QianyiClientOptions } from "./client.js"
export * as Constants from "./constants.js"
export * as Webhook from "./modules/webhook.js"

export interface QianyiSDKConfig {
  baseUrl: string
  appId: string
  appSecret: string
  timeout?: number
}

export class QianyiSDK {
  shop: ReturnType<typeof createShopModule>
  sku: ReturnType<typeof createSkuModule>
  order: ReturnType<typeof createOrderModule>
  returnOrder: ReturnType<typeof createReturnOrderModule>
  warehouse: ReturnType<typeof createWarehouseModule>
  inventory: ReturnType<typeof createInventoryModule>
  asn: ReturnType<typeof createAsnModule>
  odo: ReturnType<typeof createOdoModule>
  adjustment: ReturnType<typeof createAdjustmentModule>
  purchase: ReturnType<typeof createPurchaseModule>
  logistics: ReturnType<typeof createLogisticsModule>
  report: ReturnType<typeof createReportModule>
  customField: ReturnType<typeof createCustomFieldModule>
  supplier: ReturnType<typeof createSupplierModule>

  constructor(config: QianyiSDKConfig) {
    const client = new QianyiClient(config)
    this.shop = createShopModule(client)
    this.sku = createSkuModule(client)
    this.order = createOrderModule(client)
    this.returnOrder = createReturnOrderModule(client)
    this.warehouse = createWarehouseModule(client)
    this.inventory = createInventoryModule(client)
    this.asn = createAsnModule(client)
    this.odo = createOdoModule(client)
    this.adjustment = createAdjustmentModule(client)
    this.purchase = createPurchaseModule(client)
    this.logistics = createLogisticsModule(client)
    this.report = createReportModule(client)
    this.customField = createCustomFieldModule(client)
    this.supplier = createSupplierModule(client)
  }
}
