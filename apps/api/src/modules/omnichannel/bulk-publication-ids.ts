/** Max ids per bulk withdraw — matches listPublications slice cap. */
export const BULK_WITHDRAW_PUBLICATION_MAX = 100;

/**
 * Normalize admin bulk publication ids for withdraw.
 * Returns cleaned unique ids or a Persian error string (no throw).
 */
export function normalizeBulkPublicationIds(
  ids: unknown,
  max = BULK_WITHDRAW_PUBLICATION_MAX,
): { ids: string[] } | { error: string } {
  if (!Array.isArray(ids)) {
    return { error: 'لیست شناسه انتشار الزامی است' };
  }
  const cleaned = [
    ...new Set(
      ids
        .map((value) => String(value ?? '').trim())
        .filter((value) => value.length > 0),
    ),
  ];
  if (!cleaned.length) {
    return { error: 'حداقل یک انتشار انتخاب کنید' };
  }
  if (cleaned.length > max) {
    return { error: `حداکثر ${max} انتشار در هر درخواست` };
  }
  return { ids: cleaned };
}
