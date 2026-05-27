-- Agent 运行时平台 Schema
-- 在 Supabase SQL Editor 中执行

CREATE SCHEMA IF NOT EXISTS agent;

-- 会话表
CREATE TABLE IF NOT EXISTS agent.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '新对话',
  agent_type TEXT NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 消息表
CREATE TABLE IF NOT EXISTS agent.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL DEFAULT '',
  tool_calls JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 用户记忆表
CREATE TABLE IF NOT EXISTS agent.user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  memory_key TEXT NOT NULL,
  memory_value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, memory_key)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON agent.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON agent.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON agent.user_memory(user_id);

-- RLS 策略
ALTER TABLE agent.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent.user_memory ENABLE ROW LEVEL SECURITY;

-- conversations: 用户只能读写自己的会话
CREATE POLICY "user_conversations_access" ON agent.conversations
  FOR ALL USING (auth.uid()::text = user_id);

-- messages: 通过 conversation 间接控制（会话所有者才能访问其消息）
CREATE POLICY "user_messages_access" ON agent.messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agent.conversations
      WHERE agent.conversations.id = agent.messages.conversation_id
        AND agent.conversations.user_id = auth.uid()::text
    )
  );

-- user_memory: 用户只能读写自己的记忆
CREATE POLICY "user_memory_access" ON agent.user_memory
  FOR ALL USING (auth.uid()::text = user_id);
