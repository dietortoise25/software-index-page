import type { QianyiClient } from "../client.js"

export function createReportModule(client: QianyiClient) {
  return {
    shopeeTransaction(params: Record<string, unknown>) {
      return client.post("QUERY_SHOPEE_TRANSACTION_DETAIL_LIST", params, "/api/v1/report")
    },
    lazadaTransaction(params: Record<string, unknown>) {
      return client.post("QUERY_LAZADA_TRANSACTION_DETAIL_LIST", params, "/api/v1/report")
    },
    tiktokTransaction(params: Record<string, unknown>) {
      return client.post("QUERY_TIKTOK_TRANSACTION_DETAIL_LIST", params, "/api/v1/report")
    },
    shopeePayout(params: Record<string, unknown>) {
      return client.post("QUERY_SHOPEE_PAYOUT_DETAIL_LIST", params, "/api/v1/report")
    },
    lazadaAccount(params: Record<string, unknown>) {
      return client.post("QUERY_LAZADA_ACCOUNT_TRANSACTION_LIST", params, "/api/v1/report")
    },
    tiktokV2(params: Record<string, unknown>) {
      return client.post("QUERY_TIKTOK_V2_TRANSACTION_DETAIL_LIST", params, "/api/v1/report")
    },
    tiktokWithdrawals(params: Record<string, unknown>) {
      return client.post("QUERY_TIKTOK_WITHDRAWALS_DETAIL_LIST", params, "/api/v1/report")
    },
  }
}
