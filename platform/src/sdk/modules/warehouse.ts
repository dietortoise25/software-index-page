import type { QianyiClient } from "../client.js"

export function createWarehouseModule(client: QianyiClient) {
  return {
    list(params: { page?: number; pageSize?: number } = {}) {
      return client.post("QUERY_WAREHOUSE_LIST", params, "/api/v1/warehouse")
    },
  }
}
