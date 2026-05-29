-- 新闻汇集 — 多用户配置系统
-- 在 Supabase SQL Editor 中执行

CREATE TABLE IF NOT EXISTS agent.news_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_news_configs_user_id ON agent.news_configs(user_id, created_at DESC);
ALTER TABLE agent.news_configs ENABLE ROW LEVEL SECURITY;
