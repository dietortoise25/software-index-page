import XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config-store.js';

function getDataDir() {
  return path.resolve(loadConfig().DATA_DIR);
}

type Platform = 'tiktok' | 'shopee';
type RecordRow = Record<string, string>;

export interface ParsedSheet {
  sheets: Record<string, RecordRow[]>;
  meta: { file: string; sheetCount: number };
}

const KNOWN_FILES: Record<Platform, string> = {
  tiktok: 'TIKTOK导出弃单明细2026-05-12T16_08_49+08_00_oxTsg.xls',
  shopee: 'SHOPEE导出弃单明细2026-05-12T16_17_47+08_00_mar6E.xls',
};

function resolveFile(pattern: string): string {
  const dataDir = getDataDir();
  if (pattern in KNOWN_FILES) return path.join(dataDir, KNOWN_FILES[pattern as Platform]);
  const files = fs.readdirSync(dataDir);
  const match = files.find(f => f.toLowerCase().includes(pattern.toLowerCase()));
  if (!match) throw new Error(`未找到匹配 "${pattern}" 的文件，可用文件: ${files.join(', ')}`);
  return path.join(dataDir, match);
}

function rowsFromSheet(ws: XLSX.WorkSheet): RecordRow[] {
  const rows = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(ws, { header: 1, defval: '' });
  if (rows.length === 0) return [];
  const headers = rows[0] as string[];
  return rows.slice(1).map(row => {
    const obj: RecordRow = {};
    headers.forEach((h, i) => { obj[h] = String(row[i] ?? ''); });
    return obj;
  });
}

function parseWorkbook(wb: XLSX.WorkBook, filename: string): ParsedSheet {
  const result: ParsedSheet = {
    sheets: {},
    meta: { file: filename, sheetCount: wb.SheetNames.length },
  };
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    result.sheets[name] = rowsFromSheet(ws);
  }
  return result;
}

export function parseXls(filePath: string): ParsedSheet {
  const wb = XLSX.readFile(filePath);
  return parseWorkbook(wb, path.basename(filePath));
}

export function parseXlsFromBuffer(buffer: Buffer, filename: string): ParsedSheet {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  return parseWorkbook(wb, filename);
}

export function parseByKeyword(keyword: string): ParsedSheet {
  const filePath = resolveFile(keyword);
  return parseXls(filePath);
}

export function parseAll(): Record<string, ParsedSheet> {
  const dataDir = getDataDir();
  const results: Record<string, ParsedSheet> = {};
  for (const [platform, filename] of Object.entries(KNOWN_FILES) as [Platform, string][]) {
    const filePath = path.join(dataDir, filename);
    results[platform] = parseXls(filePath);
  }
  return results;
}
