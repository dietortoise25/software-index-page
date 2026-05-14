import { parseXls, parseByKeyword, parseAll, type ParsedSheet } from './parser.js';
import { normalizeRows, getSchema, type Platform, type UnifiedRow } from './normalize.js';
import fs from 'node:fs';
import path from 'node:path';

interface Flags {
  platform: string;
  file: string;
  raw: boolean;
  schema: boolean;
  out: string;
}

interface OutputEntry {
  file: string;
  sheet: string;
  totalRows: number;
  rows: Record<string, string>[] | UnifiedRow[];
}

function printUsage(): void {
  console.log(`
用法: npx tsx src/index.ts [选项]

选项:
  --platform, -p    指定平台: tiktok | shopee (不指定则解析全部)
  --file, -f        直接指定文件路径
  --raw             输出原始字段（不标准化）
  --schema          输出统一字段映射说明
  --out, -o         输出到文件 (默认输出到 stdout)
  --help, -h        显示帮助

示例:
  pnpm parse                          # 解析全部文件
  pnpm parse:tiktok                   # 仅解析 TikTok
  pnpm parse:shopee                   # 仅解析 Shopee
  npx tsx src/index.ts -f data_example/xxx.xls  # 指定文件
`);
}

function parseFlags(args: string[]): Flags {
  const flags: Flags = { platform: '', file: '', raw: false, schema: false, out: '' };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-p': case '--platform': flags.platform = args[++i]; break;
      case '-f': case '--file':     flags.file = args[++i]; break;
      case '--raw':                 flags.raw = true; break;
      case '--schema':              flags.schema = true; break;
      case '-o': case '--out':      flags.out = args[++i]; break;
      case '-h': case '--help':     printUsage(); process.exit(0);
    }
  }
  return flags;
}

function detectPlatform(key: string): Platform {
  return key.toLowerCase().includes('tiktok') ? 'tiktok' : 'shopee';
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  if (flags.schema) {
    console.log(JSON.stringify(getSchema(), null, 2));
    return;
  }

  let results: Record<string, ParsedSheet>;
  if (flags.file) {
    results = { [path.basename(flags.file)]: parseXls(path.resolve(flags.file)) };
  } else if (flags.platform) {
    results = { [flags.platform]: parseByKeyword(flags.platform) };
  } else {
    results = parseAll();
  }

  const output: Record<string, OutputEntry> = {};
  for (const [key, parsed] of Object.entries(results)) {
    const platform = detectPlatform(key);
    for (const [sheetName, rows] of Object.entries(parsed.sheets)) {
      output[key] = {
        file: parsed.meta.file,
        sheet: sheetName,
        totalRows: rows.length,
        rows: flags.raw ? rows : normalizeRows(rows, platform),
      };
    }
  }

  const json = JSON.stringify(output, null, 2);

  if (flags.out) {
    fs.writeFileSync(path.resolve(flags.out), json, 'utf8');
    console.log(`已输出到 ${flags.out}`);
  } else {
    console.log(json);
  }
}

main().catch(err => {
  console.error('解析失败:', err.message);
  process.exit(1);
});
