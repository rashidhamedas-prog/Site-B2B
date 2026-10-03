export type SkuChangePlan = {
  newSku: string;
  aliasOld: string | null;
};

export function planSkuChange(currentSku: string, nextSku: string): SkuChangePlan | null {
  const current = String(currentSku || '').trim();
  const next = String(nextSku || '').trim();
  if (!next || next === current) return null;
  return { newSku: next, aliasOld: current || null };
}

export function skuIsOccupied(
  candidate: string,
  occupied: Iterable<string>,
  exceptProductSkus: Iterable<string> = [],
): boolean {
  const want = String(candidate || '').trim().toLowerCase();
  if (!want) return true;
  const skip = new Set(
    [...exceptProductSkus].map((s) => String(s || '').trim().toLowerCase()).filter(Boolean),
  );
  for (const raw of occupied) {
    const value = String(raw || '').trim().toLowerCase();
    if (!value || skip.has(value)) continue;
    if (value === want) return true;
  }
  return false;
}
