"""从 docs/店铺信息.xlsx 读取店铺-运营者绑定，seed 到 Supabase"""
import os, re, sys
import openpyxl
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])

# ── 读取 Excel ──
xlsx = openpyxl.load_workbook(os.path.join(os.path.dirname(__file__), "../../docs/店铺信息.xlsx"))
ws = xlsx["DefaultSheet"]

excel_rows = []
for row in ws.iter_rows(min_row=2, values_only=True):
    title = str(row[0] or "")
    operators_str = str(row[2] or "")
    shop_id_raw = str(row[12] or "")
    shop_name = str(row[18] or "")
    operators = [o.strip() for o in operators_str.split(",") if o.strip()]
    if not operators:
        continue
    excel_rows.append({"title": title, "operators": operators, "shop_id": shop_id_raw, "shop_name": shop_name})

# ── 获取 DB 店铺 ──
db_shops = sb.table("shops").select("shop_id, name, platform").execute().data
print(f"Excel行数: {len(excel_rows)}, DB店铺数: {len(db_shops)}")

# ── 匹配 ──
def extract_nums(s):
    return re.findall(r"\d{7,}", s)

matches = []
unmatched = []
for row in excel_rows:
    nums = extract_nums(row["title"]) + extract_nums(row["shop_id"]) + extract_nums(row["shop_name"])
    found = None
    for num in nums:
        found = next((s for s in db_shops if num in s["name"]), None)
        if found:
            break
    if found:
        matches.append({**row, "db_shop": found})
    else:
        unmatched.append(row)

print(f"匹配成功: {len(matches)}, 未匹配: {len(unmatched)}")
for r in unmatched:
    print(f"  未匹配: {r['title'][:60]} | shop_id={r['shop_id']}")

# ── 运营者汇总 ──
all_ops = set()
for m in matches:
    for o in m["operators"]:
        all_ops.add(o)
print(f"\n运营者 ({len(all_ops)}人): {', '.join(sorted(all_ops))}")

# ── 清理并 Seed ──
schema = sb.schema("internal")
print("\n清理旧数据...")
schema.table("shop_operators").delete().neq("id", 0).execute()
schema.table("operators").delete().neq("id", 0).execute()
schema.table("operator_groups").delete().neq("id", 0).execute()

# 分组
groups = ["步凡者（巴西）", "美度邦（巴西）", "步凡者（台湾）"]
group_ids = {}
for name in groups:
    r = schema.table("operator_groups").insert({"name": name}).execute()
    if r.data:
        group_ids[name] = r.data[0]["id"]
        print(f"分组: {name} id={r.data[0]['id']}")

# 人员
op_ids = {}
for name in all_ops:
    r = schema.table("operators").insert({"name": name}).execute()
    if r.data:
        op_ids[name] = r.data[0]["id"]
        print(f"人员: {name} id={r.data[0]['id']}")

# 绑定：一个店铺可能对应多个运营者（Excel中逗号分隔）
bound = 0
errors = 0
for m in matches:
    sid = m["db_shop"]["shop_id"]
    gid = group_ids.get("步凡者（巴西）")  # 默认分组
    for op_name in m["operators"]:
        oid = op_ids.get(op_name)
        if not oid:
            continue
        try:
            r = schema.table("shop_operators").insert({
                "shop_id": sid, "operator_id": oid, "group_id": gid
            }).execute()
            if r.data:
                bound += 1
        except Exception as e:
            errors += 1
            if errors <= 3:
                print(f"绑定失败: {m['db_shop']['name']} → {op_name}: {e}")

print(f"\n完成: {bound} 条绑定, {errors} 个错误")
