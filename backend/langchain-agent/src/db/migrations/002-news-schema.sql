-- 新闻汇集 Agent Schema
-- 在 Supabase SQL Editor 中执行

-- 新闻配置表：可配置的键值存储
CREATE TABLE IF NOT EXISTS agent.news_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 默认配置
INSERT INTO agent.news_config (key, value) VALUES
  ('topics', '["AI", "LLM", "AI Agent"]'),
  ('keywords', '["大模型", "智能体"]'),
  ('cron', '"0 9 * * *"'),
  ('receive_id', '""'),
  ('receive_type', '"open_id"'),
  ('language', '"zh"'),
  ('max_results', '10')
ON CONFLICT (key) DO NOTHING;

-- 流水线运行记录表
CREATE TABLE IF NOT EXISTS agent.news_digest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'cron')),
  search_query TEXT,
  result_count INTEGER,
  summary JSONB,
  card_json JSONB,
  feishu_response JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_news_digest_runs_started_at ON agent.news_digest_runs(started_at DESC);

ALTER TABLE agent.news_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent.news_digest_runs ENABLE ROW LEVEL SECURITY;
