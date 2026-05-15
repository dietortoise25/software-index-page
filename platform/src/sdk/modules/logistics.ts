import type { QianyiClient } from "../client.js"

export function createLogisticsModule(client: QianyiClient) {
  return {
    listFirstLeg(params: Record<string, unknown> = {}) {
      return client.post("QUERY_FIRST_LEG_ORDER_LIST", params, "/api/v1/firstLeg")
    },
    createFirstLeg(params: Record<string, unknown>) {
      return client.post("CREATE_FIRST_LEG_ORDER", params, "/api/v1/firstLeg")
    },
    queryLogistics(params: Record<string, unknown>) {
      return client.post("QUERY_FIRST_LRG_LOGISTICS", params, "/api/v1/firstLeg")
    },
    queryTracking(params: Record<string, unknown>) {
      return client.post("QUERY_FIRST_LRG_TRACKING_PACKAGE", params, "/api/v1/firstLeg")
    },
    withdrawFirstLeg(params: Record<string, unknown>) {
      return client.post("WITHDRAW_AND_DEL_FIRST_LEG", params, "/api/v1/firstLeg")
    },
  }
}
