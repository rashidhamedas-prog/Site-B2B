import { sizesForSizeType } from './product-pack';

export type SizeChartSource = {
  sizeType?: string | null;
  sizeLabels?: Array<string | null | undefined> | null;
};

export type SizedRow = { id?: string; size?: string | null };

/**
 * Labels that belong on the product size chart.
 * Empty chart (CUSTOM with no labels yet) means "do not prune / do not filter".
 */
export function sizeChartLabels(source: SizeChartSource): string[] {
  return sizesForSizeType(source.sizeType, source.sizeLabels);
}

export function sizeChartSet(source: SizeChartSource): Set<string> | null {
  const labels = sizeChartLabels(source);
  if (!labels.length) return null;
  return new Set(labels);
}

/** Keep rows whose size is on the chart. Blank size kept. Empty chart → no filter. */
export function variantsOnSizeChart<T extends SizedRow>(
  variants: T[] | null | undefined,
  source: SizeChartSource,
): T[] {
  const rows = variants ?? [];
  const allowed = sizeChartSet(source);
  if (!allowed) return rows;
  return rows.filter((row) => {
    const size = String(row.size ?? '').trim();
    return !size || allowed.has(size);
  });
}

/** Variant ids (or rows without id) whose size is outside the chart. */
export function orphanSizeVariants<T extends SizedRow>(
  variants: T[] | null | undefined,
  source: SizeChartSource,
): T[] {
  const rows = variants ?? [];
  const allowed = sizeChartSet(source);
  if (!allowed) return [];
  return rows.filter((row) => {
    const size = String(row.size ?? '').trim();
    return !!size && !allowed.has(size);
  });
}
