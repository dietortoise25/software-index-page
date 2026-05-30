import { z } from "zod"

const slug = z.string().min(1, "Slug 不能为空").max(100).regex(/^[a-z0-9-]+$/, "Slug 只能包含小写字母、数字和连字符")

export const articleSchema = z.object({
  slug,
  title: z.string().min(1, "标题不能为空").max(200),
  summary: z.string().max(500).optional().default(""),
  content: z.string(),
  cover_image: z.string().url("必须是有效的 URL").or(z.literal("")).optional().default(""),
  author: z.string().max(50).optional().default("Alan"),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
  status: z.enum(["draft", "published"]).optional().default("draft"),
})

export const groupSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(50),
})

export const operatorSchema = z.object({
  name: z.string().min(1, "姓名不能为空").max(20),
})

export const shopBindingSchema = z.object({
  shop_id: z.number().positive("请选择店铺"),
  operator_id: z.number().positive("请选择运营者"),
})

export const requirementFormSchema = z.object({
  type: z.string().min(1, "请选择需求类型"),
  title: z.string().min(2, "标题至少 2 个字符").max(80),
  priority: z.string().min(1, "请选择优先级"),
  department: z.string().max(50).optional().default(""),
  description: z.string().min(5, "描述至少 5 个字符").max(2000),
  expectedDate: z.string().optional().default(""),
  contact: z.string().max(100).optional().default(""),
})

export const tiktokCredentialsSchema = z.object({
  appKey: z.string().min(1, "AppKey 不能为空"),
  appSecret: z.string().min(1, "AppSecret 不能为空"),
  redirectUri: z.string().url("必须是有效的 URL"),
})

export const newsConfigSchema = z.object({
  topics: z.array(z.string()).max(10, "最多 10 个主题"),
  keywords: z.array(z.string()).max(10, "最多 10 个关键词"),
  cron: z.string().min(1, "Cron 不能为空"),
  receive_id: z.string().min(1, "接收者 ID 不能为空"),
  receive_type: z.enum(["open_id", "chat_id"]),
  language: z.enum(["zh", "en"]),
  search_count: z.number().min(1, "至少搜索 1 条").max(100, "最多搜索 100 条"),
  card_count: z.number().min(1, "至少 1 条卡片").max(50, "最多 50 条卡片"),
  mode: z.enum(["manual", "ai"]),
  goal: z.string().optional().default(""),
})
