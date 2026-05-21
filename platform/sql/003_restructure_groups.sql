-- ===== 重构：人员不再直接属于分组，分组通过店铺绑定传递 =====

-- 1. shop_operators 加 group_id
ALTER TABLE internal.shop_operators ADD COLUMN IF NOT EXISTS group_id BIGINT REFERENCES internal.operator_groups(id);

-- 2. operators 去掉 group_id
ALTER TABLE internal.operators DROP COLUMN IF EXISTS group_id;

-- 3. 更新 RLS（新列需要策略覆盖，已存在 Allow all 所以无需改动）
