import type { QianyiClient } from "../client.js"

export function createOdoModule(client: QianyiClient) {
  return {
    list(params: Record<string, unknown> = {}) {
      return client.post("QUERY_ODO_LIST", params, "/api/v1/odo")
    },
    create(params: Record<string, unknown>) {
      return client.post("CREATE_ODO_ORDER", params, "/api/v1/odo")
    },
    cancel(params: { odoNumber: string }) {
      return client.post("CANCEL_ODO_ORDER", params, "/api/v1/odo")
    },
    querySalesOdo(params: { orderNumber: string }) {
      return client.post("QUERY_SALES_ODO_LIST", params, "/api/v1/odo")
    },
    receive(params: { odoNumber: string }) {
      return client.post("RECEIVE_ODO_ORDER", params, "/api/v1/odo")
    },
  }
}
