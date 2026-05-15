import type { QianyiClient } from "../client.js"

export function createInventoryModule(client: QianyiClient) {
  return {
    listV2(params: Record<string, unknown> = {}) {
      return client.post("QUERY_SIMPLE_LIST_INVENTORY_V2", params, "/api/v1/inventory")
    },
    queryLog(params: Record<string, unknown>) {
      return client.post("QUERY_INVENTORY_LOG_LIST", params, "/api/v1/inventory")
    },
    queryAssembly(params: Record<string, unknown>) {
      return client.post("QUERY_INVENTORY_ASSEMBLY_LIST", params, "/api/v1/inventory")
    },
    createTransfer(params: Record<string, unknown>) {
      return client.post("CREATE_TRANSFER_AVAILABLE_ORDER", params, "/api/v1/inventory")
    },
    queryTransfer(params: Record<string, unknown>) {
      return client.post("QUERY_INVENTORY_TRANSFER_LIST", params, "/api/v1/inventory")
    },
    queryRestore(params: Record<string, unknown>) {
      return client.post("QUERY_INVENTORY_RESTORE_LIST", params, "/api/v1/inventory")
    },
    queryStorageLocation(params: Record<string, unknown>) {
      return client.post("QUERY_STORAGE_LOCATION_INVENTORY_LIST", params, "/api/v1/inventory")
    },
    queryBatch(params: Record<string, unknown>) {
      return client.post("QUERY_BATCH_INVENTORY_LIST", params, "/api/v1/inventory")
    },
    transferStorageLocation(params: Record<string, unknown>) {
      return client.post("TRANSFER_STORAGE_LOCATION", params, "/api/v1/inventory")
    },
  }
}
