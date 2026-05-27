import "dotenv/config"
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, ToolMessage } from "@langchain/core/messages"
import { DynamicStructuredTool } from "@langchain/core/tools"
import "../tools/built-in/get-current-time.js"
import { listTools } from "../tools/registry.js"

function toLangChainTool(t: ReturnType<typeof listTools>[number]) {
  return new DynamicStructuredTool({
    name: t.name,
    description: t.description,
    schema: t.schema,
    func: t.func,
  })
}

async function test() {
  const tools = listTools()
  console.log("已注册工具:", tools.map(t => t.name).join(", "))

  const model = new ChatOpenAI({
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL || "deepseek-chat",
    temperature: 0.7,
    configuration: { baseURL: process.env.LLM_BASE_URL },
  })

  const lcTools = tools.map(toLangChainTool)
  const modelWithTools = model.bindTools(lcTools)

  console.log("\n=== 问: 现在几点？ ===")
  const response = await modelWithTools.invoke([new HumanMessage("现在几点？")])

  const toolCalls = (response as any).tool_calls
  if (toolCalls && toolCalls.length > 0) {
    console.log("✓ 模型决定调用工具:", toolCalls.map((tc: any) => tc.name).join(", "))
    for (const tc of toolCalls) {
      const tool = tools.find(t => t.name === tc.name)
      if (tool) {
        const result = await tool.func(tc.args)
        console.log("  结果:", result)
      }
    }
  } else {
    console.log("✗ 模型未调用工具，直接回复:", (response as any).content?.substring(0, 200))
  }
}

test()
