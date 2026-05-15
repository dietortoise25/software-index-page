import type { QianyiClient } from "../client.js"

export function createAdjustmentModule(client: QianyiClient) {
  return {
    list(params: Record<string, unknown> = {}) {
      return client.post("QUERY_ADJUSTMENT_LIST", params, "/api/v1/adjustment")
    },
    create(params: Record<string, unknown>) {
      return client.post("CREATE_ADJUSTMENT_ORDER", params, "/api/v1/adjustment")
    },
  }
}
