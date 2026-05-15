import type { QianyiClient } from "../client.js"

export function createPurchaseModule(client: QianyiClient) {
  return {
    list(params: Record<string, unknown> = {}) {
      return client.post("QUERY_PURCHASE_ORDER_LIST", params, "/api/v1/purchase")
    },
    create(params: Record<string, unknown>) {
      return client.post("CREATE_PURCHASE_ORDER", params, "/api/v1/purchase")
    },
    queryPlan(params: Record<string, unknown>) {
      return client.post("QUERY_PURCHASE_PLAN_LIST", params, "/api/v1/purchase")
    },
  }
}
