import "dotenv/config"
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage } from "@langchain/core/messages"

async function test(modelName: string) {
  const model = new ChatOpenAI({
    apiKey: process.env.LLM_API_KEY,
    model: modelName,
    temperature: 0,
    configuration: { baseURL: process.env.LLM_BASE_URL },
  })
  console.log(`\n=== ${modelName} ===`)
  const res = await model.invoke([new HumanMessage("回复一个字：好")])
  const msg = res as any
  console.log("content:", msg.content?.substring(0, 50))
  console.log("has reasoning_content:", !!msg.additional_kwargs?.reasoning_content)
}

// 对比：默认 vs 关 thinking
await test("deepseek-v4-flash")

const modelNoThink = new ChatOpenAI({
  apiKey: process.env.LLM_API_KEY,
  model: "deepseek-v4-flash",
  temperature: 0,
  configuration: { baseURL: process.env.LLM_BASE_URL },
  modelKwargs: { thinking: { type: "disabled" } },
})
console.log("\n=== deepseek-v4-flash (thinking disabled) ===")
const res2 = await modelNoThink.invoke([new HumanMessage("回复一个字：好")])
const msg2 = res2 as any
console.log("content:", msg2.content?.substring(0, 50))
console.log("has reasoning_content:", !!msg2.additional_kwargs?.reasoning_content)
