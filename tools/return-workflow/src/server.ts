import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import { parseXls, parseXlsFromBuffer, parseAll, type ParsedSheet } from './parser.js';
import { mergeAndClassify, saveCsv, type ProcessedRow } from './merger.js';
import { fetchStoreMap } from './store-map.js';
import { fetchExistingRecords, deduplicate, batchInsert, uploadImageToFeishu } from './bitable.js';
import { loadConfig, saveConfig, resolveWikiToken, type ReturnWorkflowConfig } from './config-store.js';

const app = express();

app.use(cors());
app.use(express.json());

// 首次加载配置
let cfg = loadConfig();
const PORT = cfg.PORT;

function reloadConfig() {
  cfg = loadConfig();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: cfg.UPLOAD_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xls' || ext === '.xlsx') { cb(null, true); } else { cb(new Error('仅支持 .xls / .xlsx 文件')); }
  },
});

// ── 任务状态管理 ──
interface Task {
  id: string;
  status: 'processing' | 'done' | 'error';
  createdAt: string;
  summary?: Record<string, number | string>;
  error?: string;
  progress: { step: string; current: number; total: number };
}
const tasks = new Map<string, Task>();
setInterval(() => {
  // 清理 1h 前完成的任务
  const cutoff = Date.now() - 3600000;
  for (const [id, t] of tasks) {
    if (t.status !== 'processing' && new Date(t.createdAt).getTime() < cutoff) tasks.delete(id);
  }
}, 600000);

const FIELD_NAMES_WAREHOUSE = [
  '订单编号', '店铺名称', '责任方', '序号', '是否配对正确', '图片',
  '平台', '站点', '退单类型', '退款申请金额', '最新状态', '商品名称',
  'SKU', 'SKU货号', '订单付款金额', '订单物流公司', '订单物流单号',
  '下单时间', '退单时间', '最后更新时间', '退货物流单号', '备注',
  '退款描述', '逆向物流', '逆向物流单号', '买家昵称', '主商品货号',
  '订单调整金额明细', '订单调整金额总额', '订单收入', '正向物流',
];

const FIELD_NAMES_NON_WAREHOUSE = [
  '订单编号', '店铺名称', '客诉原因', '处理结果', '图片',
  '平台', '退单编号', '站点', '退单类型', '退款申请金额', '最新状态', '商品名称',
  'SKU', 'SKU货号', '订单付款金额', '订单物流公司', '订单物流单号',
  '下单时间', '退单时间', '最后更新时间', '退货物流单号', '备注',
  '退款描述', '逆向物流', '逆向物流单号', '买家昵称', '主商品货号',
  '订单调整金额明细', '订单调整金额总额', '订单收入', '正向物流',
];

// 元数据字段（两表共用）
function metaFields(r: ProcessedRow): (string | null)[] {
  const o = r.original;
  const isTk = o.platform === 'tiktok';
  return [
    o.site, o.returnType, o.refundAmount, o.status, o.productName,
    o.sku, o.skuCode, o.orderAmount, o.logisticsCompany, o.logisticsNo,
    o.orderTime, o.returnTime, o.updateTime,
    isTk ? (o.returnLogisticsNo || '') : '', o.remark || '',
    o.refundDesc || '', o.returnLogistics || '',
    isTk ? '' : (o.returnLogisticsNo || ''),
    o.buyerNick || '', o.productCode || '', o.adjustDetail || '',
    o.adjustTotal || '', o.income || '', o.forwardLogistics || '',
  ];
}

function buildWarehouseRow(r: ProcessedRow): (string | null)[] {
  const o = r.original;
  return [
    r.orderNo, r.standardShop || r.shop, '仓库', r.returnNo, '未配对',
    null, // 图片 — 由 uploadImagesConcurrent 事后填充
    o.platform === 'tiktok' ? 'TikTok' : 'Shopee',
    ...metaFields(r),
  ];
}

function buildNonWarehouseRow(r: ProcessedRow): (string | null)[] {
  const o = r.original;
  return [
    r.orderNo, r.standardShop || r.shop, r.classification, r.rawReason,
    null, // 图片 — 由 uploadImagesConcurrent 事后填充
    o.platform === 'tiktok' ? 'TikTok' : 'Shopee',
    o.returnNo,
    ...metaFields(r),
  ];
}

/**
 * 并发上传图片：每批 CONCURRENCY 张
 */
async function uploadImagesConcurrent(
  tableId: string,
  recordImageMap: Map<string, string[]>,
  task?: Task,
): Promise<number> {
  const entries = [...recordImageMap.entries()]
  const concurrency = cfg.CONCURRENCY
  let uploaded = 0

  // 获取 token（复用）
  const axios = (await import("axios")).default
  const tokenRes = await axios.post("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    app_id: cfg.FEISHU_APP_ID,
    app_secret: cfg.FEISHU_APP_SECRET,
  })
  const token = (tokenRes.data as { tenant_access_token: string }).tenant_access_token

  const apiBase = "https://open.feishu.cn/open-apis/bitable/v1/apps"

  async function processOne(recordId: string, url: string) {
    try {
      const fileToken = await uploadImageToFeishu(url, token)
      if (!fileToken) return
      await axios.put(
        `${apiBase}/${cfg.FEISHU_BASE_TOKEN}/tables/${tableId}/records/${recordId}`,
        { fields: { "图片": [{ file_token: fileToken }] } },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } },
      )
      uploaded++
    } catch { /* 错误已在 uploadImageToFeishu 内部记录 */ }
  }

  const allTasks: (() => Promise<void>)[] = []
  for (const [recordId, urls] of entries) {
    for (const url of urls) {
      if (!url?.startsWith("http")) continue
      allTasks.push(() => processOne(recordId, url))
    }
  }

  const total = allTasks.length
  if (task && total > 0) {
    task.progress = { step: `下载+上传 0/${total} (成0)`, current: 4, total: 6 }
  }
  if (total > 0) {
    console.log(`[image] 开始串行上传 ${total} 张图片 (表=${tableId.slice(0,8)}...)`)
  }

  // 串行执行，每张总超时 25s（Promise.race 兜底）
  for (let i = 0; i < total; i++) {
    const timer = `25s-${i}`
    const timeoutP = new Promise<void>(r => setTimeout(r, 25000))
    await Promise.race([allTasks[i](), timeoutP])
    if (task) task.progress = { step: `下载+上传 ${i + 1}/${total} (成${uploaded})`, current: 4 + Math.floor((i + 1) / total * 2), total: 6 }
    if (i < total - 1) await new Promise(r => setTimeout(r, 1200))
  }

  // 去掉 processOne 内部更新（避免冲突）


  return uploaded;
}

async function runProcess(parsedMap: Record<string, ParsedSheet>, task: Task) {
  try {
    console.log(`[task:${task.id}] 开始处理, 文件数:${Object.keys(parsedMap).length}`)
    task.progress = { step: '读取店铺映射', current: 0, total: 1 };
    const storeMap = await fetchStoreMap();
    task.progress = { step: '合并分类', current: 1, total: 6 };

    const { warehouse, nonWarehouse } = mergeAndClassify(parsedMap, storeMap);
    const csvPath = saveCsv([...warehouse, ...nonWarehouse]);
    const whWithEvidence = warehouse.filter(r => r.refundEvidence).length
    const nwWithEvidence = nonWarehouse.filter(r => r.refundEvidence).length
    console.log(`[merge] 仓库:${warehouse.length}条(含证据${whWithEvidence}) 非仓库:${nonWarehouse.length}条(含证据${nwWithEvidence})`)
    task.progress = { step: '读取飞书现有记录', current: 2, total: 6 };

    const [existingW, existingNw] = await Promise.all([
      fetchExistingRecords(cfg.FEISHU_TABLE_WAREHOUSE),
      fetchExistingRecords(cfg.FEISHU_TABLE_NON_WAREHOUSE),
    ]);

    const newWarehouse = deduplicate(warehouse as unknown as Record<string, unknown>[], existingW, 'orderNo', 'returnNo');
    const newNonWarehouse = deduplicate(nonWarehouse as unknown as Record<string, unknown>[], existingNw, 'orderNo', 'returnNo');
    task.progress = { step: `去重完成：仓库${newWarehouse.length}条 + 非仓库${newNonWarehouse.length}条待录入`, current: 3, total: 4 };

    // 写入仓库
    let whInserted = 0;
    task.progress = { step: `写入仓库表 (${newWarehouse.length} 条)...`, current: 4, total: 6 };
    const whImageMap = new Map<string, string[]>();
    if (newWarehouse.length > 0) {
      const rows = (newWarehouse as unknown as ProcessedRow[]).map(buildWarehouseRow);
      const ids = await batchInsert(cfg.FEISHU_TABLE_WAREHOUSE, FIELD_NAMES_WAREHOUSE, rows as (string | null)[][]);
      whInserted = ids.length;
      for (let i = 0; i < ids.length; i++) {
        const ev = (newWarehouse[i] as unknown as ProcessedRow).refundEvidence;
        if (ev) { const urls = ev.split('\n').filter(u => u.startsWith('http')); if (urls.length) whImageMap.set(ids[i], urls); }
      }
      const totalEvidenceUrls = [...whImageMap.values()].reduce((s, urls) => s + urls.length, 0)
      console.log(`[insert] 仓库表写入${whInserted}条, 待上传图片:${totalEvidenceUrls}张 (${whImageMap.size}条记录)`)
    }

    // 写入非仓库
    task.progress = { step: `写入非仓库表 (${newNonWarehouse.length} 条)...`, current: 5, total: 6 };
    let nwInserted = 0;
    const nwImageMap = new Map<string, string[]>();
    if (newNonWarehouse.length > 0) {
      const rows = (newNonWarehouse as unknown as ProcessedRow[]).map(buildNonWarehouseRow);
      const ids = await batchInsert(cfg.FEISHU_TABLE_NON_WAREHOUSE, FIELD_NAMES_NON_WAREHOUSE, rows as (string | null)[][]);
      nwInserted = ids.length;
      for (let i = 0; i < ids.length; i++) {
        const ev = (newNonWarehouse[i] as unknown as ProcessedRow).refundEvidence;
        if (ev) { const urls = ev.split('\n').filter(u => u.startsWith('http')); if (urls.length) nwImageMap.set(ids[i], urls); }
      }
      const totalEvidenceUrls = [...nwImageMap.values()].reduce((s, urls) => s + urls.length, 0)
      console.log(`[insert] 非仓库表写入${nwInserted}条, 待上传图片:${totalEvidenceUrls}张 (${nwImageMap.size}条记录)`)
    }

    // 并发上传图片
    const [whImgs, nwImgs] = await Promise.all([
      uploadImagesConcurrent(cfg.FEISHU_TABLE_WAREHOUSE, whImageMap, task),
      uploadImagesConcurrent(cfg.FEISHU_TABLE_NON_WAREHOUSE, nwImageMap, task),
    ]);
    console.log(`[image] 仓库图片:${whImgs}张 非仓库图片:${nwImgs}张`)

    task.summary = {
      totalParsed: warehouse.length + nonWarehouse.length,
      warehouseResponsibility: warehouse.length,
      nonWarehouseResponsibility: nonWarehouse.length,
      warehouseToInsert: newWarehouse.length,
      nonWarehouseToInsert: newNonWarehouse.length,
      warehouseDeduped: warehouse.length - newWarehouse.length,
      nonWarehouseDeduped: nonWarehouse.length - newNonWarehouse.length,
      warehouseInserted: whInserted,
      nonWarehouseInserted: nwInserted,
      warehouseImagesUploaded: whImgs,
      nonWarehouseImagesUploaded: nwImgs,
      baseToken: cfg.FEISHU_BASE_TOKEN,
      tenantDomain: cfg.FEISHU_TENANT_DOMAIN,
      tableWarehouse: cfg.FEISHU_TABLE_WAREHOUSE,
      tableNonWarehouse: cfg.FEISHU_TABLE_NON_WAREHOUSE,
      csvPath: csvPath as unknown as string,
    };
    task.status = 'done';
    console.log(`[task:${task.id}] 完成: 解析${task.summary?.totalParsed} 录入${task.summary?.warehouseInserted}+${task.summary?.nonWarehouseInserted} 图片${task.summary?.warehouseImagesUploaded}+${task.summary?.nonWarehouseImagesUploaded}`)
  } catch (err) {
    task.status = 'error';
    task.error = String(err);
    console.error(`[task:${task.id}] 失败:`, String(err).slice(0, 200))
  }
}

// ── 路由 ──
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 配置读写
app.get('/config', (_req, res) => {
  const current = loadConfig();
  // 密钥脱敏
  const safe = {
    ...current,
    FEISHU_APP_SECRET: current.FEISHU_APP_SECRET
      ? current.FEISHU_APP_SECRET.slice(0, 4) + '****' + current.FEISHU_APP_SECRET.slice(-4)
      : '',
  };
  res.json(safe);
});

app.post('/config', (req, res) => {
  try {
    const partial = req.body as Partial<ReturnWorkflowConfig>;
    // 不带值的字段从 body 中删除（不过滤）
    const merged = saveConfig(partial);
    reloadConfig();
    res.json({ ok: true, config: merged });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

// 快速配置：从 URL 解析表格
app.post('/config/parse-url', async (req, res) => {
  try {
    const { url } = req.body as { url: string }
    if (!url) { res.status(400).json({ ok: false, error: '缺少 url 参数' }); return }

    // 解析 URL
    const u = new URL(url)
    const pathParts = u.pathname.split('/').filter(Boolean)
    const token = pathParts[pathParts.length - 1] || ''
    const type = pathParts[pathParts.length - 2] || ''  // 'wiki' or 'base'
    const tenant = u.hostname.split('.')[0]
    const queryTable = u.searchParams.get('table') || ''

    // 获取 access token
    const axios = (await import('axios')).default
    const authRes = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: cfg.FEISHU_APP_ID, app_secret: cfg.FEISHU_APP_SECRET,
    })
    const accessToken = (authRes.data as { tenant_access_token: string }).tenant_access_token

    // 解析 base token
    let baseToken = token
    const appRes = await axios.get(`https://open.feishu.cn/open-apis/bitable/v1/apps/${token}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      validateStatus: () => true,
    })
    const appData = appRes.data as { code: number; data?: { app?: { app_token?: string; name?: string } } }
    if (appData.code === 0 && appData.data?.app?.app_token) {
      baseToken = appData.data.app.app_token
    }

    // 列出所有表
    const tables: { table_id: string; name: string }[] = []
    const tablesRes = await axios.get(`https://open.feishu.cn/open-apis/bitable/v1/apps/${baseToken}/tables`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    for (const item of (tablesRes.data as { data?: { items?: { table_id: string; name: string }[] } })?.data?.items ?? []) {
      tables.push({ table_id: item.table_id, name: item.name })
    }

    res.json({
      ok: true,
      baseToken,
      tenant,
      tables,
      queryTable,
      baseName: appData.data?.app?.name || '',
    })
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

app.post('/process', upload.array('files', cfg.UPLOAD_MAX_FILES), async (req, res) => {
  const parsedMap: Record<string, ParsedSheet> = {};

  const files = req.files as Express.Multer.File[] | undefined;
  if (files?.length) {
    for (const file of files) parsedMap[file.originalname] = parseXlsFromBuffer(file.buffer, file.originalname);
  }

  const hasLocal = req.query.local !== 'false' || Object.keys(parsedMap).length === 0;
  if (hasLocal) {
    try {
      const local = parseAll();
      for (const [k, v] of Object.entries(local)) { if (!parsedMap[k]) parsedMap[k] = v; }
    } catch { /* 忽略 */ }
  }

  if (Object.keys(parsedMap).length === 0) {
    res.status(400).json({ ok: false, error: '没有可解析的文件' });
    return;
  }

  const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const task: Task = {
    id: taskId,
    status: 'processing',
    createdAt: new Date().toISOString(),
    progress: { step: '初始化', current: 0, total: 6 },
  };
  tasks.set(taskId, task);

  // 不 await，后台执行
  runProcess(parsedMap, task);

  res.json({ ok: true, taskId, status: 'processing' });
});

app.get('/task/:taskId', (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) { res.status(404).json({ ok: false, error: '任务不存在' }); return; }
  res.json({ ok: true, ...task });
});

app.get('/tasks', (_req, res) => {
  const list = [...tasks.values()].slice(-20).reverse();
  res.json({ ok: true, tasks: list });
});

async function start() {
  // 自动解析 wiki token → base token（如果配置的是 wiki token）
  const resolved = await resolveWikiToken()
  if (resolved !== cfg.FEISHU_BASE_TOKEN) {
    reloadConfig()
  }

  app.listen(PORT, () => {
    console.log(`[config] BASE_TOKEN=${cfg.FEISHU_BASE_TOKEN.slice(0, 8)}... TABLE_STORE_MAP=${cfg.TABLE_STORE_MAP}`);
    console.log(`ReturnFlow API: http://localhost:${PORT}`);
    console.log(`  POST /process      — 提交任务`);
    console.log(`  GET  /task/:taskId  — 查询任务进度`);
    console.log(`  GET  /tasks         — 最近任务列表`);
    console.log(`  GET  /health        — 健康检查`);
  });
}
start()
