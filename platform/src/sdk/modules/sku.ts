import type { QianyiClient } from "../client.js"

export interface SkuListParams { page?: number; pageSize?: number; skuList?: string[] }
export interface SkuCreateParams { sku: string; title: string; [key: string]: unknown }
export interface SkuUpdateParams { sku: string; [key: string]: unknown }
export interface SkuStatusParams { sku: string; enable: number }

export function createSkuModule(client: QianyiClient) {
  return {
    list(params: SkuListParams = {}) {
      return client.post("QUERY_SIMPLE_LIST_SKU", params, "/api/v1/sku")
    },
    create(params: SkuCreateParams) {
      return client.post("UPDATE_SKU_INFO", params, "/api/v1/sku")
    },
    update(params: SkuUpdateParams) {
      return client.post("UPDATE_SKU_INFO", params, "/api/v1/sku")
    },
    updateStatus(params: SkuStatusParams) {
      return client.post("UPDATE_SKU_STATUS", params, "/api/v1/sku")
    },
    querySysSku(params: SkuListParams = {}) {
      return client.post("QUERY_SYS_SKU_LIST_SKU", params, "/api/v1/sku")
    },
  }
}
