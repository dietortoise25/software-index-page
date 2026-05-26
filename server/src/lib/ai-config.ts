import { createDeepSeek } from "@ai-sdk/deepseek"

export const DEEPSEEK_MODEL = "deepseek-v4-flash"

export const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY || "",
  baseURL: process.env.DEEPSEEK_API_URL_OpenAI || "https://api.deepseek.com",
})
