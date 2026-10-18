/**
 * Minimal OOXML (.xlsx) reader for admin imports.
 * Supports store (0) and deflate (8) ZIP entries, shared strings, inlineStr, numbers.
 * No third-party spreadsheet dependency — pairs with xlsx-builder.ts.
 */

import { inflateRawSync } from 'zlib';

export type XlsxSheetMatrix = {
  name: string;
  rows: string[][];
};

const MAX_XLSX_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 20_000;
const MAX_COLS = 64;

function xmlUnescape(raw: string): string {
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function colIndex(letters: string): number {
  let n = 0;
  const s = letters.toUpperCase();
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 65 || code > 90) return -1;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

function parseCellRef(ref: string): { col: number; row: number } | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref.trim());
  if (!m) return null;
  const col = colIndex(m[1]!);
  const row = Number(m[2]);
  if (col < 0 || !Number.isFinite(row) || row < 1) return null;
  return { col, row };
}

type ZipEntry = { name: string; data: Buffer };

function readZipEntries(buf: Buffer): ZipEntry[] {
  if (buf.length > MAX_XLSX_BYTES) {
    throw new Error('حجم فایل اکسل بیشتر از ۸ مگابایت است');
  }
  const entries: ZipEntry[] = [];
  let offset = 0;
  while (offset + 30 <= buf.length) {
    const sig = buf.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const method = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const uncompSize = buf.readUInt32LE(offset + 22);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLen;
    const dataStart = nameEnd + extraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > buf.length) {
      throw new Error('فایل اکسل آسیب‌دیده است');
    }
    const name = buf.subarray(nameStart, nameEnd).toString('utf8');
    const compressed = buf.subarray(dataStart, dataEnd);
    let data: Buffer;
    if (method === 0) {
      data = Buffer.from(compressed);
    } else if (method === 8) {
      try {
        data = inflateRawSync(compressed);
      } catch {
        throw new Error('باز کردن فشرده‌سازی اکسل ناموفق بود');
      }
      if (uncompSize && data.length !== uncompSize) {
        // Some writers leave size 0 when bit 3 is set; tolerate length mismatch only then.
        if (uncompSize > 0 && Math.abs(data.length - uncompSize) > 0) {
          /* keep inflated bytes */
        }
      }
    } else {
      throw new Error('فرمت فشرده‌سازی اکسل پشتیبانی نمی‌شود');
    }
    entries.push({ name, data });
    offset = dataEnd;
  }
  if (!entries.length) {
    throw new Error('فایل اکسل معتبر نیست');
  }
  return entries;
}

function entryMap(entries: ZipEntry[]): Map<string, Buffer> {
  const map = new Map<string, Buffer>();
  for (const e of entries) {
    map.set(e.name.replace(/^\/+/, ''), e.data);
  }
  return map;
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const block = m[1] || '';
    const texts = [...block.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => xmlUnescape(x[1] || ''));
    out.push(texts.join(''));
  }
  return out;
}

function parseSheetXml(xml: string, shared: string[]): string[][] {
  const grid = new Map<string, string>();
  let maxRow = 0;
  let maxCol = 0;
  const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(xml))) {
    const attrs = m[1] || m[3] || '';
    const body = m[2] || '';
    const refM = /\br="([^"]+)"/.exec(attrs);
    if (!refM) continue;
    const pos = parseCellRef(refM[1]!);
    if (!pos || pos.col >= MAX_COLS || pos.row > MAX_ROWS) continue;
    const typeM = /\bt="([^"]+)"/.exec(attrs);
    const t = typeM?.[1] || '';
    let value = '';
    if (t === 'inlineStr') {
      const tm = /<t[^>]*>([\s\S]*?)<\/t>/.exec(body);
      value = tm ? xmlUnescape(tm[1] || '') : '';
    } else if (t === 's') {
      const vm = /<v>([\s\S]*?)<\/v>/.exec(body);
      const idx = vm ? Number(vm[1]) : NaN;
      value = Number.isInteger(idx) ? String(shared[idx] ?? '') : '';
    } else if (t === 'b') {
      const vm = /<v>([\s\S]*?)<\/v>/.exec(body);
      value = vm?.[1] === '1' ? 'TRUE' : 'FALSE';
    } else if (t === 'str' || t === 'e') {
      const vm = /<v>([\s\S]*?)<\/v>/.exec(body);
      value = vm ? xmlUnescape(vm[1] || '') : '';
    } else {
      const vm = /<v>([\s\S]*?)<\/v>/.exec(body);
      value = vm ? String(vm[1] || '').trim() : '';
    }
    grid.set(`${pos.row}:${pos.col}`, value);
    if (pos.row > maxRow) maxRow = pos.row;
    if (pos.col > maxCol) maxCol = pos.col;
  }
  const rows: string[][] = [];
  for (let r = 1; r <= maxRow; r++) {
    const row: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      row.push(grid.get(`${r}:${c}`) ?? '');
    }
    rows.push(row);
  }
  return rows;
}

function parseWorkbookSheets(workbookXml: string, relsXml: string): Array<{ name: string; path: string }> {
  const targetById = new Map<string, string>();
  const relRe = /<Relationship\b([^>]*)\/>/g;
  let rm: RegExpExecArray | null;
  while ((rm = relRe.exec(relsXml))) {
    const attrs = rm[1] || '';
    const id = /\bId="([^"]+)"/.exec(attrs)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];
    if (id && target) targetById.set(id, target.replace(/\\/g, '/'));
  }
  const sheets: Array<{ name: string; path: string }> = [];
  const sheetRe = /<sheet\b([^>]*)\/>/g;
  let sm: RegExpExecArray | null;
  while ((sm = sheetRe.exec(workbookXml))) {
    const attrs = sm[1] || '';
    const name = /\bname="([^"]+)"/.exec(attrs)?.[1];
    const rid = /\br:id="([^"]+)"/.exec(attrs)?.[1];
    if (!name || !rid) continue;
    const target = targetById.get(rid);
    if (!target) continue;
    const path = target.startsWith('/')
      ? target.slice(1)
      : `xl/${target.replace(/^\.\//, '')}`;
    sheets.push({ name: xmlUnescape(name), path });
  }
  return sheets;
}

/** Parse first worksheets from an .xlsx buffer into string matrices. */
export function parseXlsx(buffer: Buffer): XlsxSheetMatrix[] {
  const files = entryMap(readZipEntries(buffer));
  const workbook = files.get('xl/workbook.xml');
  const rels = files.get('xl/_rels/workbook.xml.rels');
  if (!workbook || !rels) {
    throw new Error('ساختار اکسل ناقص است');
  }
  const sharedXml = files.get('xl/sharedStrings.xml');
  const shared = sharedXml ? parseSharedStrings(sharedXml.toString('utf8')) : [];
  const metas = parseWorkbookSheets(workbook.toString('utf8'), rels.toString('utf8'));
  if (!metas.length) {
    throw new Error('هیچ شیتی در اکسل یافت نشد');
  }
  return metas.map((meta) => {
    const sheetBuf = files.get(meta.path);
    if (!sheetBuf) {
      throw new Error(`شیت «${meta.name}» خوانده نشد`);
    }
    return {
      name: meta.name,
      rows: parseSheetXml(sheetBuf.toString('utf8'), shared),
    };
  });
}

export function findSheet(sheets: XlsxSheetMatrix[], preferredNames: string[]): XlsxSheetMatrix | null {
  const norm = (s: string) => s.replace(/\s+/g, '').trim();
  for (const want of preferredNames) {
    const hit = sheets.find((sh) => norm(sh.name) === norm(want));
    if (hit) return hit;
  }
  return sheets[0] || null;
}
