import "dotenv/config"
import { ChatDeepSeek } from "@langchain/deepseek"
import { HumanMessage } from "@langchain/core/messages"
import { StringOutputParser } from "@langchain/core/output_parsers"

console.log("API Key:", process.env.LLM_API_KEY ? "已加载" : "缺失")
console.log("Model:", process.env.LLM_MODEL)
console.log("Base URL:", process.env.LLM_BASE_URL)

const model = new ChatDeepSeek({
  apiKey: process.env.LLM_API_KEY,
  model: process.env.LLM_MODEL || "deepseek-chat",
  temperature: 0.7,
  configuration: { baseURL: process.env.LLM_BASE_URL },
})

try {
  const stream = await model.pipe(new StringOutputParser()).stream([new HumanMessage("hi")])
  console.log("--- 流开始 ---")
  for await (const chunk of stream) {
    process.stdout.write(chunk)
  }
  console.log("\n--- 流完成 ---")
} catch (e) {
  console.error("错误:", e instanceof Error ? e.message : String(e))
}
