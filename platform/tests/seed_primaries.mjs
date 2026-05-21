import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const i = sb.schema("internal");

const { data: shops } = await sb.from("shops").select("shop_id, name");
const { data: ops } = await i.from("operators").select("id, name");

// 模糊匹配：店铺名中的关键词 → 运营者名
function findOperator(shopName) {
  for (const o of ops) {
    if (shopName.includes(o.name)) return o;
    if (o.name.length >= 2 && shopName.includes(o.name.slice(-2))) return o;
    // 单字特殊匹配
    if (o.name === "小方" && shopName.includes("方正")) return o;
    if (o.name === "闫柳霖" && shopName.includes("霖")) return o;
  }
  return null;
}

let ok = 0, skip = 0;
for (const s of shops || []) {
  const op = findOperator(s.name);
  if (!op) { console.log("跳过:", s.name); skip++; continue; }

  // 设为当前主负责人
  // 先查是否存在
  const { data: existing } = await i.from("shop_operators").select("id").eq("shop_id", s.shop_id).eq("operator_id", op.id);
  if (existing?.length) {
    await i.from("shop_operators").update({ is_primary: true, effective_from: "2026-01-01", effective_to: null }).eq("id", existing[0].id);
  } else {
    await i.from("shop_operators").insert({ shop_id: s.shop_id, operator_id: op.id, is_primary: true, effective_from: "2026-01-01", effective_to: null });
  }
  ok++; console.log(s.name, "→", op.name);
}

console.log(`\n完成: ${ok} 家主负责人, ${skip} 跳过`);
