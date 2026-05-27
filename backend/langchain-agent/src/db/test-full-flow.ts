import "dotenv/config"
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { StringOutputParser } from "@langchain/core/output_parsers"
import "../tools/built-in/get-current-time.js"
import { listTools } from "../tools/registry.js"

// 模拟生产 chat.ts 的完整流程（不用 modelKwargs 关 thinking）
async function test() {
  const tools = listTools()
  console.log("工具:", tools.map(t => t.name).join(", "))

  const model = new ChatOpenAI({
    apiKey: process.env.LLM_API_KEY,
    model: "deepseek-v4-flash",
    temperature: 0.7,
    configuration: { baseURL: process.env.LLM_BASE_URL },
    // 注意：不传 modelKwargs，thinking 默认开启
  })

  // Step 1: 工具调用预检
  const langChainTools = tools.map(t => new DynamicStructuredTool({
    name: t.name, description: t.description, schema: t.schema, func: t.func,
  }))
  const bound = model.bindTools(langChainTools)

  const lcMessages = [new HumanMessage("现在几点？")]
  console.log("\nStep 1: pre-flight invoke...")
  const toolCheck = await bound.invoke(lcMessages)
  const msg = toolCheck as AIMessage
  console.log("has tool_calls:", !!msg.tool_calls?.length)
  console.log("has reasoning_content:", !!(msg as any).additional_kwargs?.reasoning_content)

  const toolCalls = msg.tool_calls
  if (toolCalls && toolCalls.length > 0) {
    lcMessages.push(msg)
    for (const tc of toolCalls) {
      const tool = tools.find(t => t.name === tc.name)
      if (tool) {
        const result = await tool.func(tc.args)
        lcMessages.push(new ToolMessage(result, tc.id!))
      }
    }
  }

  // Step 2: 流式调用（模拟生产，带 reasoning_content 的 AIMessage 在历史中）
  console.log("\nStep 2: stream call...")
  try {
    const stream = await model.pipe(new StringOutputParser()).stream(lcMessages)
    let full = ""
    for await (const chunk of stream) {
      full += chunk
    }
    console.log("Response:", full.substring(0, 200))
    console.log("SUCCESS")
  } catch (e: any) {
    console.log("FAILED:", e.message?.substring(0, 200))
  }
}

test()
