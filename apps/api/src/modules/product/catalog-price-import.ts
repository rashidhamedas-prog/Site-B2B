/**
 * Admin price-only Excel template + row validation (wholesale + retail).
 * Empty price cells mean "leave unchanged". Match key: SKU.
 */

import { buildXlsx, type ExcelCell, type ExcelSheet } from '../../common/xlsx-builder';
import { findSheet, parseXlsx } from '../../common/xlsx-reader';
import { irrToToman } from './catalog-excel';
import {
  normalizeProductChannelPrices,
  type ProductChannelPrices,
} from './product-channel-prices';

export const PRICE_IMPORT_SHEET = 'قیمت‌ها';
export const PRICE_IMPORT_MAX_ROWS = 5_000;
export const PRICE_IMPORT_MAX_BYTES = 8 * 1024 * 1024;

export const PRICE_HEADERS = {
  id: 'شناسه',
  sku: 'SKU',
  name: 'نام (فقط راهنما — نادیده گرفته می‌شود)',
  wholesaleFinal: 'قیمت نهایی عمده (تومان)',
  wholesaleCompare: 'قیمت قبل تخفیف عمده (تومان)',
  retailFinal: 'قیمت نهایی تکی (تومان)',
  retailCompare: 'قیمت قبل تخفیف تکی (تومان)',
} as const;

const HEADER_LIST = [
  PRICE_HEADERS.id,
  PRICE_HEADERS.sku,
  PRICE_HEADERS.name,
  PRICE_HEADERS.wholesaleFinal,
  PRICE_HEADERS.wholesaleCompare,
  PRICE_HEADERS.retailFinal,
  PRICE_HEADERS.retailCompare,
];

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function tomanToIrr(toman: number): number {
  return Math.round(toman * 10);
}

export function normalizeHeader(raw: string): string {
  return String(raw || '')
    .replace(/\u200c/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type TomanParse = { ok: true; value: number | null } | { ok: false; error: string };

function tomanParseError(result: TomanParse): string | undefined {
  if (result.ok === false) return result.error;
  return undefined;
}

export function parseTomanCell(raw: unknown): TomanParse {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  let s = String(raw).trim();
  if (!s) return { ok: true, value: null };
  let out = '';
  for (const ch of s) {
    const pi = PERSIAN_DIGITS.indexOf(ch);
    if (pi >= 0) {
      out += String(pi);
      continue;
    }
    const ai = ARABIC_DIGITS.indexOf(ch);
    if (ai >= 0) {
      out += String(ai);
      continue;
    }
    out += ch;
  }
  out = out.replace(/,/g, '').replace(/[٬،]/g, '').replace(/\s+/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(out)) {
    return { ok: false, error: 'مبلغ تومان نامعتبر است' };
  }
  const n = Number(out);
  if (!Number.isFinite(n)) return { ok: false, error: 'مبلغ تومان نامعتبر است' };
  if (n < 0) return { ok: false, error: 'مبلغ نمی‌تواند منفی باشد' };
  if (!Number.isInteger(n)) {
    return { ok: false, error: 'مبلغ تومان باید عدد صحیح باشد' };
  }
  if (n > Number.MAX_SAFE_INTEGER / 10) {
    return { ok: false, error: 'مبلغ خارج از محدوده است' };
  }
  return { ok: true, value: n };
}

export type PriceImportProduct = {
  id: string;
  sku: string;
  name: string;
  showOnWholesale?: boolean | null;
  showOnRetail?: boolean | null;
  wholesalePrice: number;
  retailPrice?: number | null;
  wholesaleCompareAtPrice?: number | null;
  retailCompareAtPrice?: number | null;
};

export type ParsedPriceRow = {
  excelRow: number;
  id: string;
  sku: string;
  nameHint: string;
  wholesaleFinalToman: number | null;
  wholesaleCompareToman: number | null;
  retailFinalToman: number | null;
  retailCompareToman: number | null;
  touchedWholesaleFinal: boolean;
  touchedWholesaleCompare: boolean;
  touchedRetailFinal: boolean;
  touchedRetailCompare: boolean;
  parseError?: string;
};

export type PriceRowPlan =
  | {
      kind: 'skip';
      excelRow: number;
      sku: string;
      reason: string;
    }
  | {
      kind: 'error';
      excelRow: number;
      sku: string;
      message: string;
    }
  | {
      kind: 'change';
      excelRow: number;
      sku: string;
      productId: string;
      before: ProductChannelPrices;
      after: ProductChannelPrices;
      patch: ProductChannelPrices & {
        wholesaleIsDiscounted: boolean;
        retailIsDiscounted: boolean;
        isDiscounted: boolean;
      };
    };

function guideSheet(): ExcelSheet {
  return {
    name: 'راهنما',
    headers: ['موضوع', 'مقدار'],
    rows: [
      ['هدف', 'فقط به‌روزرسانی قیمت عمده و تکی — موجودی/نام/دسته تغییر نمی‌کند'],
      ['شیت داده', PRICE_IMPORT_SHEET],
      ['کلید تطبیق', 'SKU (اجباری)'],
      ['شناسه', 'اختیاری؛ اگر پر شود باید با همان محصول SKU یکی باشد'],
      ['سلول خالی قیمت', 'بدون تغییر همان فیلد'],
      ['واحد', 'تومان (در دیتابیس ×۱۰ به‌صورت ریال ذخیره می‌شود)'],
      ['قیمت نهایی', 'قیمت قابل پرداخت کانال (بعد از تخفیف)'],
      ['قیمت قبل تخفیف', 'اختیاری؛ اگر پر شود باید از قیمت نهایی همان کانال بیشتر باشد'],
      ['سقف ردیف داده', String(PRICE_IMPORT_MAX_ROWS)],
      ['جریان امن', '۱) دانلود قالب ۲) پر کردن ۳) پیش‌نمایش ۴) اعمال'],
    ],
  };
}

export function buildPriceImportTemplate(products: PriceImportProduct[]): {
  buffer: Buffer;
  filename: string;
} {
  const rows: ExcelCell[][] = products.map((p) => [
    p.id,
    p.sku,
    p.name,
    irrToToman(p.wholesalePrice),
    irrToToman(p.wholesaleCompareAtPrice),
    irrToToman(p.retailPrice),
    irrToToman(p.retailCompareAtPrice),
  ]);
  if (!rows.length) {
    rows.push(['', 'SAMPLE-SKU', 'نمونه — این ردیف را حذف یا با SKU واقعی جایگزین کنید', 250000, '', 320000, '']);
  }
  const sheets: ExcelSheet[] = [
    { name: PRICE_IMPORT_SHEET, headers: [...HEADER_LIST], rows },
    guideSheet(),
  ];
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    buffer: buildXlsx(sheets),
    filename: `taranom-price-update-template-${stamp}.xlsx`,
  };
}

function headerIndexMap(headerRow: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const key = normalizeHeader(h);
    if (key) map.set(key, i);
  });
  return map;
}

function cellAt(row: string[], idx: number | undefined): string {
  if (idx == null || idx < 0) return '';
  return String(row[idx] ?? '').trim();
}

export function parsePriceImportBuffer(buffer: Buffer): ParsedPriceRow[] {
  if (!buffer?.length) throw new Error('فایل خالی است');
  if (buffer.length > PRICE_IMPORT_MAX_BYTES) {
    throw new Error('حجم فایل اکسل بیشتر از ۸ مگابایت است');
  }
  const sheets = parseXlsx(buffer);
  const sheet = findSheet(sheets, [PRICE_IMPORT_SHEET, 'قيمت‌ها', 'قیمت ها', 'قیمت']);
  if (!sheet || !sheet.rows.length) {
    throw new Error(`شیت «${PRICE_IMPORT_SHEET}» یافت نشد`);
  }
  const headerRow = sheet.rows[0] || [];
  const idx = headerIndexMap(headerRow);
  const skuCol = idx.get(normalizeHeader(PRICE_HEADERS.sku)) ?? idx.get('SKU');
  if (skuCol == null) {
    throw new Error('ستون SKU در ردیف اول الزامی است');
  }
  const idCol = idx.get(normalizeHeader(PRICE_HEADERS.id)) ?? idx.get('شناسه');
  const nameCol = idx.get(normalizeHeader(PRICE_HEADERS.name));
  const wFinalCol = idx.get(normalizeHeader(PRICE_HEADERS.wholesaleFinal));
  const wCmpCol = idx.get(normalizeHeader(PRICE_HEADERS.wholesaleCompare));
  const rFinalCol = idx.get(normalizeHeader(PRICE_HEADERS.retailFinal));
  const rCmpCol = idx.get(normalizeHeader(PRICE_HEADERS.retailCompare));
  if (wFinalCol == null && rFinalCol == null) {
    throw new Error('حداقل یکی از ستون‌های قیمت نهایی عمده یا تکی لازم است');
  }

  const parsed: ParsedPriceRow[] = [];
  for (let i = 1; i < sheet.rows.length; i++) {
    const row = sheet.rows[i] || [];
    const excelRow = i + 1;
    const sku = cellAt(row, skuCol);
    const id = cellAt(row, idCol);
    const nameHint = cellAt(row, nameCol);
    const allEmpty =
      !sku &&
      !id &&
      !cellAt(row, wFinalCol) &&
      !cellAt(row, wCmpCol) &&
      !cellAt(row, rFinalCol) &&
      !cellAt(row, rCmpCol);
    if (allEmpty) continue;

    const wFinalRaw = cellAt(row, wFinalCol);
    const wCmpRaw = cellAt(row, wCmpCol);
    const rFinalRaw = cellAt(row, rFinalCol);
    const rCmpRaw = cellAt(row, rCmpCol);

    const wFinal = parseTomanCell(wFinalRaw);
    const wCmp = parseTomanCell(wCmpRaw);
    const rFinal = parseTomanCell(rFinalRaw);
    const rCmp = parseTomanCell(rCmpRaw);

    parsed.push({
      excelRow,
      id,
      sku,
      nameHint,
      wholesaleFinalToman: wFinal.ok ? wFinal.value : null,
      wholesaleCompareToman: wCmp.ok ? wCmp.value : null,
      retailFinalToman: rFinal.ok ? rFinal.value : null,
      retailCompareToman: rCmp.ok ? rCmp.value : null,
      touchedWholesaleFinal: wFinalCol != null && wFinalRaw !== '',
      touchedWholesaleCompare: wCmpCol != null && wCmpRaw !== '',
      touchedRetailFinal: rFinalCol != null && rFinalRaw !== '',
      touchedRetailCompare: rCmpCol != null && rCmpRaw !== '',
      parseError:
        tomanParseError(wFinal) ||
        tomanParseError(wCmp) ||
        tomanParseError(rFinal) ||
        tomanParseError(rCmp),
    });
  }

  if (parsed.length > PRICE_IMPORT_MAX_ROWS) {
    throw new Error(`حداکثر ${PRICE_IMPORT_MAX_ROWS} ردیف داده مجاز است`);
  }
  return parsed;
}

export function planPriceImportRows(
  rows: ParsedPriceRow[],
  productsBySku: Map<string, PriceImportProduct>,
  productsById: Map<string, PriceImportProduct>,
): PriceRowPlan[] {
  const plans: PriceRowPlan[] = [];
  const seenSku = new Map<string, number>();

  for (const raw of rows) {
    const skuKey = String(raw.sku || '').trim();
    if (raw.parseError) {
      plans.push({
        kind: 'error',
        excelRow: raw.excelRow,
        sku: skuKey,
        message: `ردیف ${raw.excelRow}: ${raw.parseError}`,
      });
      continue;
    }
    if (!skuKey) {
      plans.push({
        kind: 'error',
        excelRow: raw.excelRow,
        sku: '',
        message: `ردیف ${raw.excelRow}: SKU الزامی است`,
      });
      continue;
    }
    const skuLower = skuKey.toLowerCase();
    const prev = seenSku.get(skuLower);
    if (prev != null) {
      plans.push({
        kind: 'error',
        excelRow: raw.excelRow,
        sku: skuKey,
        message: `ردیف ${raw.excelRow}: SKU تکراری با ردیف ${prev}`,
      });
      continue;
    }
    seenSku.set(skuLower, raw.excelRow);

    const bySku = productsBySku.get(skuLower);
    if (!bySku) {
      plans.push({
        kind: 'error',
        excelRow: raw.excelRow,
        sku: skuKey,
        message: `ردیف ${raw.excelRow}: محصول با SKU «${skuKey}» یافت نشد`,
      });
      continue;
    }
    if (raw.id) {
      const byId = productsById.get(raw.id);
      if (!byId || byId.id !== bySku.id) {
        plans.push({
          kind: 'error',
          excelRow: raw.excelRow,
          sku: skuKey,
          message: `ردیف ${raw.excelRow}: شناسه با SKU هم‌خوان نیست`,
        });
        continue;
      }
    }

    const anyTouch =
      raw.touchedWholesaleFinal ||
      raw.touchedWholesaleCompare ||
      raw.touchedRetailFinal ||
      raw.touchedRetailCompare;
    if (!anyTouch) {
      plans.push({
        kind: 'skip',
        excelRow: raw.excelRow,
        sku: skuKey,
        reason: 'هیچ ستون قیمتی پر نشده',
      });
      continue;
    }

    const nextWholesaleFinal = raw.touchedWholesaleFinal
      ? tomanToIrr(raw.wholesaleFinalToman!)
      : Number(bySku.wholesalePrice);
    const nextRetailFinal = raw.touchedRetailFinal
      ? raw.retailFinalToman == null
        ? null
        : tomanToIrr(raw.retailFinalToman)
      : bySku.retailPrice ?? null;
    let nextWholesaleCompare = raw.touchedWholesaleCompare
      ? raw.wholesaleCompareToman == null
        ? null
        : tomanToIrr(raw.wholesaleCompareToman)
      : bySku.wholesaleCompareAtPrice ?? null;
    let nextRetailCompare = raw.touchedRetailCompare
      ? raw.retailCompareToman == null
        ? null
        : tomanToIrr(raw.retailCompareToman)
      : bySku.retailCompareAtPrice ?? null;

    // If final rose to/above kept compare-at, clear compare-at for that channel.
    if (
      !raw.touchedWholesaleCompare &&
      nextWholesaleCompare != null &&
      nextWholesaleCompare <= nextWholesaleFinal
    ) {
      nextWholesaleCompare = null;
    }
    if (
      !raw.touchedRetailCompare &&
      nextRetailFinal != null &&
      nextRetailCompare != null &&
      nextRetailCompare <= nextRetailFinal
    ) {
      nextRetailCompare = null;
    }

    let after: ProductChannelPrices;
    try {
      after = normalizeProductChannelPrices({
        wholesalePrice: nextWholesaleFinal,
        retailPrice: nextRetailFinal,
        wholesaleCompareAtPrice: nextWholesaleCompare,
        retailCompareAtPrice: nextRetailCompare,
        showOnWholesale: bySku.showOnWholesale !== false,
        showOnRetail: bySku.showOnRetail !== false,
      });
    } catch (e) {
      plans.push({
        kind: 'error',
        excelRow: raw.excelRow,
        sku: skuKey,
        message: `ردیف ${raw.excelRow}: ${e instanceof Error ? e.message : 'قیمت نامعتبر'}`,
      });
      continue;
    }

    const before: ProductChannelPrices = {
      wholesalePrice: Number(bySku.wholesalePrice),
      retailPrice: bySku.retailPrice ?? null,
      wholesaleCompareAtPrice: bySku.wholesaleCompareAtPrice ?? null,
      retailCompareAtPrice: bySku.retailCompareAtPrice ?? null,
    };

    const changed =
      before.wholesalePrice !== after.wholesalePrice ||
      before.retailPrice !== after.retailPrice ||
      before.wholesaleCompareAtPrice !== after.wholesaleCompareAtPrice ||
      before.retailCompareAtPrice !== after.retailCompareAtPrice;

    if (!changed) {
      plans.push({
        kind: 'skip',
        excelRow: raw.excelRow,
        sku: skuKey,
        reason: 'بدون تغییر نسبت به قیمت فعلی',
      });
      continue;
    }

    const wholesaleIsDiscounted =
      after.wholesaleCompareAtPrice != null && after.wholesaleCompareAtPrice > after.wholesalePrice;
    const retailIsDiscounted =
      after.retailCompareAtPrice != null &&
      after.retailPrice != null &&
      after.retailCompareAtPrice > after.retailPrice;

    plans.push({
      kind: 'change',
      excelRow: raw.excelRow,
      sku: skuKey,
      productId: bySku.id,
      before,
      after,
      patch: {
        ...after,
        wholesaleIsDiscounted,
        retailIsDiscounted,
        isDiscounted: wholesaleIsDiscounted || retailIsDiscounted,
      },
    });
  }

  return plans;
}

export function summarizePricePlans(plans: PriceRowPlan[]) {
  let matched = 0;
  let changed = 0;
  let skipped = 0;
  let errors = 0;
  const errorSamples: Array<{ excelRow: number; sku: string; message: string }> = [];
  const changeSamples: Array<{
    excelRow: number;
    sku: string;
    before: ProductChannelPrices;
    after: ProductChannelPrices;
  }> = [];

  for (const p of plans) {
    if (p.kind === 'error') {
      errors += 1;
      if (errorSamples.length < 40) {
        errorSamples.push({ excelRow: p.excelRow, sku: p.sku, message: p.message });
      }
      continue;
    }
    matched += 1;
    if (p.kind === 'skip') {
      skipped += 1;
    } else {
      changed += 1;
      if (changeSamples.length < 25) {
        changeSamples.push({
          excelRow: p.excelRow,
          sku: p.sku,
          before: p.before,
          after: p.after,
        });
      }
    }
  }

  return {
    totalRows: plans.length,
    matched,
    changed,
    skipped,
    errors,
    errorSamples,
    changeSamples,
  };
}
