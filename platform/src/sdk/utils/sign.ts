import crypto from "crypto"

export interface SignParams {
  appId: string
  bizParam: string
  serviceType: string
  timestamp: number
  appSecret: string
}

export function generateSign({ appId, bizParam, serviceType, timestamp, appSecret }: SignParams): string {
  const signStr = `appId=${appId}bizParam=${bizParam}serviceType=${serviceType}timestamp=${timestamp}${appSecret}`
  return crypto.createHash("md5").update(signStr, "utf-8").digest("hex")
}
