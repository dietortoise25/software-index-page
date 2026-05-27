# Mock Demo — 运营负责人变动审批全流程

> 三方审批模式 · 网页发起 + 飞书审批操作 + webhook 自动写入数据库

## 一步总结

```
表单(网页填，下拉框数据来自DB)
  → Server 调飞书external_instances API 创建审批实例
    → 审批人在飞书点同意/驳回
      → Webhook 回调 Server /api/feishu/approval-callback
        → 自动更新 shop_operators (is_primary + effective_from/to)
          → 看板排名自动反映 ✅
```

## 第 1 步：网页端提交

`/internal/admin` → 「负责人管理」Tab，所有下拉框数据来自数据库：

```
┌──────────────────────────────────────────────┐
│  负责人管理                                    │
│                                              │
│  店铺      [shopee闫柳霖01（119584..）▼]       │ ← shops 表
│  原负责人  闫柳霖（当前主负责人）                 │ ← 自动查 shop_operators.is_primary=true
│  新负责人  [方正 ▼]                             │ ← operators 表
│  生效日期  [2026-03-16]                        │
│  变动原因  [闫柳霖转岗台湾业务线...]             │
│                                              │
│           [提交审批]                            │
└──────────────────────────────────────────────┘
```

提交后前端显示：

```
✅ 审批已提交
   审批单号：change_20260516_001
   状态：待审批
   👉 审批人将在飞书收到通知
```

## 第 2 步：Server 处理

`POST /api/internal/approval/submit` 收到请求后：

```javascript
// 1. 写入变动记录 (status=pending)
await db.schema("internal").from("shop_operator_changes").insert({
  shop_id: 39591, operator_id: 14,
  change_type: "transfer", effective_from: "2026-03-16",
  reason: "闫柳霖转岗台湾业务线...", status: "pending"
})

// 2. 查相关人员的飞书 open_id
const newOp = await db.from("operators").select("name, feishu_open_id").eq("id", 14)
const currentPrimary = await db.from("shop_operators")
  .select("operator_id, operator:operators(name)")
  .eq("shop_id", 39591).eq("is_primary", true).single()

// 3. 调飞书三方审批 API 创建实例
await feishuAPI.post("/open-apis/approval/v4/external_instances", {
  approval_code: "ext_appr_xxxx",           // 三方审批定义code
  instance_code: "change_20260516_001",      // 我们这边生成的唯一号
  instance_title: "运营负责人变动 — shopee闫柳霖01 → 方正",
  form_values: {
    "店铺名称": "shopee闫柳霖01（11958426739）",
    "店铺ID": "39591",                        // ★ 关键：ID 藏在 form 里
    "原负责人": currentPrimary.operator.name,
    "新负责人": newOp.name,
    "新负责人ID": "14",                       // ★ 关键：ID 藏在 form 里
    "变动类型": "交接",
    "生效日期": "2026-03-16",
    "变动原因": "闫柳霖转岗台湾业务线..."
  },
  task_list: [{
    task_id: "task_001",
    user_id: "ou_alan_open_id",             // 审批人飞书ID
    status: "PENDING"
  }]
})
```

## 第 3 步：审批人在飞书操作

飞书卡片显示：

```
┌──────────────────────────────────────────┐
│  📋 运营负责人变动审批                      │
│                                          │
│  Alan 发起                                 │
│                                          │
│  店铺名称  shopee闫柳霖01（11958426739）    │
│  原负责人  闫柳霖                           │
│  新负责人  方正                             │
│  变动类型  交接                             │
│  生效日期  2026-03-16                       │
│  变动原因  闫柳霖转岗台湾业务线...            │
│                                          │
│    [👍 同意]  [👎 驳回]                   │
└──────────────────────────────────────────┘
```

审批人点「同意」。

## 第 4 步：Webhook 自动更新数据库

飞书 webhook → `POST /api/feishu/approval-callback`：

```json
{
  "type": "event_callback",
  "event": {
    "type": "approval_instance",
    "instance_code": "change_20260516_001",
    "status": "APPROVED"
  }
}
```

Server 自动处理：

```
1. 从 instance_code 找到 pending 的变动记录
2. 更新 changes.status = 'approved', approved_at = NOW()
3. 旧负责人：effective_to = '2026-03-15', is_primary = false
4. 新负责人：effective_from = '2026-03-16', is_primary = true
5. 飞书消息通知发起人："审批已通过"
```

## 第 5 步：看板自动反映

- 运营者排名：3 月起闫柳霖只算 1~15 日，方正从 16 日计起
- 店铺时间线：新增一条交接记录
- 变动日志：永久保留，不可删除
