import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const i = sb.schema("internal");

// ── Read Excel ──
const xlsxPath = resolve(__dirname, "../../docs/店铺信息.xlsx");
const wb = XLSX.readFile(xlsxPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

// Column indices: 0=title, 2=operators, 12=shop_id, 18=shop_name
const excelRows = [];
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const title = String(row[0] || "");
  const operatorsStr = String(row[2] || "");
  const shopIdRaw = String(row[12] || "");
  const shopName = String(row[18] || "");
  const operators = operatorsStr.split(",").map(s => s.trim()).filter(Boolean);
  if (!operators.length) continue;
  excelRows.push({ title, operators, shopId: shopIdRaw, shopName });
}

// ── Get DB shops ──
const { data: dbShops } = await sb.from("shops").select("shop_id, name, platform");
console.log(`Excel: ${excelRows.length} 行, DB: ${dbShops.length} 店铺`);

// ── Match by numeric ID ──
function extractNums(s) {
  return (s.match(/\d{7,}/g) || []);
}

const matches = [];
const unmatched = [];
for (const row of excelRows) {
  const nums = [...extractNums(row.title), ...extractNums(row.shopId), ...extractNums(row.shopName)];
  let found = null;
  for (const num of nums) {
    found = dbShops.find(s => s.name.includes(num));
    if (found) break;
  }
  if (found) matches.push({ ...row, dbShop: found });
  else unmatched.push(row);
}

console.log(`匹配: ${matches.length}, 未匹配: ${unmatched.length}`);
for (const r of unmatched) console.log("  未匹配:", r.title.slice(0, 60), "|", r.shopId);

// ── Operators ──
const allOps = new Set();
for (const m of matches) for (const o of m.operators) allOps.add(o);
console.log(`\n运营者 (${allOps.size}人):`, [...allOps].join(", "));

// ── Clean & Seed ──
console.log("\n清理旧数据...");
await i.from("shop_operators").delete().neq("id", 0);
await i.from("operators").delete().neq("id", 0);
await i.from("operator_groups").delete().neq("id", 0);

// Groups
const groups = ["步凡者（巴西）", "美度邦（巴西）", "步凡者（台湾）"];
const groupIds = {};
for (const name of groups) {
  const { data } = await i.from("operator_groups").insert({ name }).select().single();
  if (data) { groupIds[name] = data.id; console.log("分组:", name, data.id); }
}

// Operators
const opIds = {};
for (const name of allOps) {
  const { data } = await i.from("operators").insert({ name }).select().single();
  if (data) { opIds[name] = data.id; console.log("人员:", name, data.id); }
}

// Bindings: each shop→operator pair from Excel
let bound = 0, errors = 0;
for (const m of matches) {
  const sid = m.dbShop.shop_id;
  const gid = groupIds["步凡者（巴西）"];
  for (const opName of m.operators) {
    const oid = opIds[opName];
    if (!oid) continue;
    const { error } = await i.from("shop_operators").insert({
      shop_id: sid, operator_id: oid, group_id: gid,
    });
    if (error) {
      if (!error.message.includes("duplicate")) {
        errors++;
        if (errors <= 3) console.error("绑定失败:", m.dbShop.name, "→", opName, error.message);
      }
    } else {
      bound++;
    }
  }
}

console.log(`\n完成: ${bound} 条绑定, ${errors} 个错误`);
