import type { QianyiClient } from "../client.js"

export function createReturnOrderModule(client: QianyiClient) {
  return {
    create(params: Record<string, unknown>) {
      return client.post("CREATE_RETURN_ORDER", params, "/api/v1/returnOrder")
    },
    close(params: { returnNumber: string }) {
      return client.post("CLOSE_RETURN_ORDER", params, "/api/v1/returnOrder")
    },
    list(params: Record<string, unknown> = {}) {
      return client.post("QUERY_RETURN_ORDER_LIST", params, "/api/v1/returnOrder")
    },
  }
}
