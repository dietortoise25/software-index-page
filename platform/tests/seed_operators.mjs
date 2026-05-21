import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const i = sb.schema("internal");

// 从店铺名称推断运营者
const OPERATOR_MAP = {
  "继文": "方继文", "方继文": "方继文", "方正": "方正",
  "肖泳怡": "肖泳怡", "闫柳霖": "闫柳霖", "万星奥": "万星奥", "黄泳桐": "黄泳桐",
};
// 运营者所属品牌
const OPERATOR_BRAND = {
  "方继文": "美度邦（巴西）", "方正": "步凡者（巴西）", "肖泳怡": "步凡者（巴西）",
  "闫柳霖": "步凡者（巴西）", "万星奥": "美度邦（巴西）", "黄泳桐": "步凡者（巴西）",
};
// 所有分组（品牌/市场）
const GROUPS = ["步凡者（巴西）", "美度邦（巴西）", "步凡者（台湾）"];

// 清空旧数据
console.log("清理旧数据...");
await i.from("shop_operators").delete().neq("id", 0);
await i.from("operators").delete().neq("id", 0);
await i.from("operator_groups").delete().neq("id", 0);

// 1. 分组
const groupIds = {};
for (const name of GROUPS) {
  const { data } = await i.from("operator_groups").insert({ name }).select().single();
  if (data) { groupIds[name] = data.id; console.log("分组:", name, data.id); }
}

// 2. 人员（不再有 group_id）
const operatorIds = {};
for (const name of new Set(Object.values(OPERATOR_MAP))) {
  const { data } = await i.from("operators").insert({ name }).select().single();
  if (data) { operatorIds[name] = data.id; console.log("人员:", name, data.id); }
}

// 3. 绑定店铺 + 分组
const { data: shops } = await sb.from("shops").select("shop_id, name");
let bound = 0;
for (const s of shops || []) {
  const opName = Object.entries(OPERATOR_MAP).find(([k]) => s.name.includes(k))?.[1];
  if (!opName) { console.log("跳过:", s.name); continue; }
  const brand = OPERATOR_BRAND[opName];
  const gid = groupIds[brand] || null;
  const { error } = await i.from("shop_operators").insert({
    shop_id: s.shop_id, operator_id: operatorIds[opName], group_id: gid,
  });
  if (error) console.error("绑定失败:", s.name, error.message);
  else { bound++; console.log("绑定:", s.name, "→", opName, "|", brand); }
}

console.log(`\n完成: ${bound} 个店铺已绑定`);
