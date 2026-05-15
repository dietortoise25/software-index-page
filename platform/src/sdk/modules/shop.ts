import type { QianyiClient } from "../client.js"

export interface ShopListParams { page?: number; pageSize?: number }

export function createShopModule(client: QianyiClient) {
  return {
    list(params: ShopListParams = {}) {
      return client.post("QUERY_SHOP_LIST", params, "/api/v1/shop")
    },
  }
}
