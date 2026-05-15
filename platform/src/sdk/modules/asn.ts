import type { QianyiClient } from "../client.js"

export function createAsnModule(client: QianyiClient) {
  return {
    list(params: Record<string, unknown> = {}) {
      return client.post("QUERY_ASN_LIST", params, "/api/v1/asn")
    },
    create(params: Record<string, unknown>) {
      return client.post("CREATE_ASN_ORDER", params, "/api/v1/asn")
    },
    cancel(params: { asnNumber: string }) {
      return client.post("CANCEL_ASN_ORDER", params, "/api/v1/asn")
    },
    batchReceive(params: Record<string, unknown>) {
      return client.post("BATCH_RECEIVE_ASN_ORDER", params, "/api/v1/asn")
    },
    queryBatch(params: Record<string, unknown>) {
      return client.post("QUERY_ASN_BATCH_LIST", params, "/api/v1/asn")
    },
  }
}
