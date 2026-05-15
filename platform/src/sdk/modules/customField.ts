import type { QianyiClient } from "../client.js"

export interface CustomFieldQueryParams {
  table: string
  page?: number
  pageSize?: number
}

export function createCustomFieldModule(client: QianyiClient) {
  return {
    query(params: CustomFieldQueryParams) {
      return client.post("CUSTOMER_FIELD_QUERY", params, "/api/v1/property")
    },
  }
}
