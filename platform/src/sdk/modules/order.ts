import type { QianyiClient } from "../client.js"

export interface OrderListParams {
  page?: number; pageSize?: number
  updateTimeFrom?: string; updateTimeTo?: string
  createTimeFrom?: string; createTimeTo?: string
  status?: string; orderNumber?: string
}

export function createOrderModule(client: QianyiClient) {
  return {
    create(params: Record<string, unknown>) {
      return client.post("CREATE_SALES_ORDER", params, "/api/v1/salesOrder")
    },
    createAndAudit(params: Record<string, unknown>) {
      return client.post("CREATE_AND_AUDIT_SALES_ORDER", params, "/api/v1/salesOrder")
    },
    close(params: { orderNumber: string }) {
      return client.post("CLOSE_SALES_ORDER", params, "/api/v1/salesOrder")
    },
    list(params: OrderListParams = {}) {
      return client.post("QUERY_SALES_ORDER_LIST", params, "/api/v1/salesOrder")
    },
    queryNumbers(params: { orderNumberList: string[] }) {
      return client.post("QUERY_SALES_ORDER_NUMBER_LIST", params, "/api/v1/salesOrder")
    },
    audit(params: { orderNumber: string }) {
      return client.post("AUDIT_SALES_ORDER", params, "/api/v1/salesOrder")
    },
    send(params: { orderNumber: string }) {
      return client.post("SEND_SALES_ORDER", params, "/api/v1/salesOrder")
    },
    querySkuSource(params: { orderNumber: string }) {
      return client.post("QUERY_SKU_SOURCE_ORDER", params, "/api/v1/salesOrder")
    },
    queryPickUpStatus(params: { orderNumber: string }) {
      return client.post("QUERY_ORDER_PICK_UP_STATUS", params, "/api/v1/salesOrder")
    },
    queryDocument(params: { orderNumber: string }) {
      return client.post("QUERY_SALES_ORDER_DOCUMENT", params, "/api/v1/salesOrder")
    },
  }
}
