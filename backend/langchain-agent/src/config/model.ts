import { ChatOpenAI } from "@langchain/openai"
import type { BaseChatModel } from "@langchain/core/language_models/chat_models"

export type ModelProvider = "deepseek"

export interface ModelOverrides {
  provider?: ModelProvider
  model?: string
  temperature?: number
  maxTokens?: number
  apiKey?: string
  baseURL?: string
  modelKwargs?: Record<string, unknown>
}

interface ResolvedConfig {
  provider: ModelProvider
  model: string
  temperature: number
  maxTokens: number
  apiKey: string
  baseURL: string
  modelKwargs: Record<string, unknown>
}

function globalConfig(): ResolvedConfig {
  return {
    provider: "deepseek",
    model: process.env.LLM_MODEL || "deepseek-chat",
    temperature: Number(process.env.LLM_TEMPERATURE || "0.7"),
    maxTokens: Number(process.env.LLM_MAX_TOKENS || "4096"),
    apiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || "",
    baseURL: process.env.LLM_BASE_URL || process.env.DEEPSEEK_API_URL_OpenAI || "https://api.deepseek.com",
    modelKwargs: {},
  }
}

export function getModel(overrides?: ModelOverrides): BaseChatModel {
  const c = { ...globalConfig(), ...overrides }

  return new ChatOpenAI({
    apiKey: c.apiKey,
    model: c.model,
    temperature: c.temperature,
    maxTokens: c.maxTokens,
    configuration: { baseURL: c.baseURL },
    modelKwargs: c.modelKwargs,
  })
}
