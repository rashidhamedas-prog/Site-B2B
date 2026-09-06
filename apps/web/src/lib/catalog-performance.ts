export function catalogHydrationKey(filtered: boolean, serializedParams: string): string {
  return filtered ? serializedParams : 'default';
}

export function isLeadCatalogImage({
  index,
  embedded = false,
  page = 1,
}: {
  index: number;
  embedded?: boolean;
  page?: number;
}): boolean {
  return !embedded && page === 1 && index === 0;
}
