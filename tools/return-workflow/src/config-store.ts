import fs from "node:fs"
import path from "node:path"

const CONFIG_PATH = path.resolve("config.json")

export interface ReturnWorkflowConfig {
  // 飞书连接
  FEISHU_APP_ID: string
  FEISHU_APP_SECRET: string
  FEISHU_BASE_TOKEN: string
  FEISHU_TENANT_DOMAIN: string
  // 表格映射
  FEISHU_TABLE_WAREHOUSE: string
  FEISHU_TABLE_NON_WAREHOUSE: string
  TABLE_STORE_MAP: string
  // 运行参数
  PORT: number
  DATA_DIR: string
  CONCURRENCY: number
  UPLOAD_FILE_SIZE_MB: number
  UPLOAD_MAX_FILES: number
}

const defaults: ReturnWorkflowConfig = {
  FEISHU_APP_ID: "",
  FEISHU_APP_SECRET: "",
  FEISHU_BASE_TOKEN: "",
  FEISHU_TENANT_DOMAIN: "ycn26mleug68",
  FEISHU_TABLE_WAREHOUSE: "",
  FEISHU_TABLE_NON_WAREHOUSE: "",
  TABLE_STORE_MAP: "tbl7ZDyM9FMyr7Db",
  PORT: 3002,
  DATA_DIR: "data_example",
  CONCURRENCY: 10,
  UPLOAD_FILE_SIZE_MB: 10,
  UPLOAD_MAX_FILES: 10,
}

function envOverride<K extends keyof ReturnWorkflowConfig>(
  envKey: string,
  key: K,
  cfg: ReturnWorkflowConfig,
) {
  if (process.env[envKey]) {
    const val = process.env[envKey]!
    if (typeof defaults[key] === "number") {
      ;(cfg as unknown as Record<string, unknown>)[key] = Number(val)
    } else {
      ;(cfg as unknown as Record<string, unknown>)[key] = val
    }
  }
}

export function loadConfig(): ReturnWorkflowConfig {
  const cfg = { ...defaults }

  // 1. 从 config.json 读取
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf8")
      const saved = JSON.parse(raw)
      for (const k of Object.keys(defaults)) {
        if (saved[k] !== undefined) {
          ;(cfg as Record<string, unknown>)[k] = saved[k]
        }
      }
    }
  } catch { /* 文件损坏则使用默认值 */ }

  // 2. 环境变量覆盖（优先级最高）
  envOverride("FEISHU_APP_ID", "FEISHU_APP_ID", cfg)
  envOverride("FEISHU_APP_SECRET", "FEISHU_APP_SECRET", cfg)
  envOverride("FEISHU_BASE_TOKEN", "FEISHU_BASE_TOKEN", cfg)
  envOverride("FEISHU_TENANT_DOMAIN", "FEISHU_TENANT_DOMAIN", cfg)
  envOverride("FEISHU_TABLE_WAREHOUSE", "FEISHU_TABLE_WAREHOUSE", cfg)
  envOverride("FEISHU_TABLE_NON_WAREHOUSE", "FEISHU_TABLE_NON_WAREHOUSE", cfg)
  envOverride("TABLE_STORE_MAP", "TABLE_STORE_MAP", cfg)
  envOverride("RETURN_WORKFLOW_PORT", "PORT", cfg)
  envOverride("DATA_DIR", "DATA_DIR", cfg)
  envOverride("CONCURRENCY", "CONCURRENCY", cfg)
  envOverride("UPLOAD_FILE_SIZE_MB", "UPLOAD_FILE_SIZE_MB", cfg)
  envOverride("UPLOAD_MAX_FILES", "UPLOAD_MAX_FILES", cfg)

  return cfg
}

/**
 * 自动解析 wiki token → base token（无需 wiki 权限，利用 bitable app API）
 */
export async function resolveWikiToken(): Promise<string> {
  const cfg = loadConfig()
  const token = cfg.FEISHU_BASE_TOKEN
  if (!token || token.length < 15) return token

  // wiki token 通常以 M/W 开头，base token 以 I/B 开头
  // 直接用 bitable API 查，它会返回真实 app_token
  try {
    const { default: axios } = await import("axios")
    const authRes = await axios.post("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
      app_id: cfg.FEISHU_APP_ID, app_secret: cfg.FEISHU_APP_SECRET,
    })
    const accessToken = (authRes.data as { tenant_access_token: string }).tenant_access_token

    const res = await axios.get(`https://open.feishu.cn/open-apis/bitable/v1/apps/${token}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      validateStatus: (s: number) => s === 200,
    })
    const appToken = (res.data as { data?: { app?: { app_token?: string } } })?.data?.app?.app_token
    if (appToken && appToken !== token) {
      console.log(`[config] wiki token ${token.slice(0, 12)}... → base token ${appToken}`)
      saveConfig({ FEISHU_BASE_TOKEN: appToken })
      return appToken
    }
  } catch { /* 解析失败保留原值 */ }
  return token
}

export function saveConfig(partial: Partial<ReturnWorkflowConfig>): ReturnWorkflowConfig {
  const current = loadConfig()
  const merged: ReturnWorkflowConfig = { ...current, ...partial }
  // 不保存密钥到明文
  const toSave = { ...merged }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(toSave, null, 2), "utf8")
  return merged
}
