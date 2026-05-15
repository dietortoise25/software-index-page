import type { QianyiClient } from "../client.js"

export function createSupplierModule(client: QianyiClient) {
  return {
    list(params: { page?: number; pageSize?: number } = {}) {
      return client.post("QUERY_SUPPLIER_LIST", params, "/api/v1/supplier")
    },
    create(params: Record<string, unknown>) {
      return client.post("CREATE_SUPPLIER", params, "/api/v1/supplier")
    },
    querySku(params: { supplierName: string }) {
      return client.post("QUERY_SUPPLIER_SKU_LIST", params, "/api/v1/supplier")
    },
    createSku(params: Record<string, unknown>) {
      return client.post("CREATE_SUPPLIER_SKU", params, "/api/v1/supplier")
    },
  }
}
