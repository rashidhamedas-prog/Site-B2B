export type MediaReferenceSource = {
  images?: Array<string | null | undefined> | null;
  html?: string | null;
  videoUrl?: string | null;
};

export function normalizeMediaUrl(url: string): string {
  return String(url || '').trim();
}

export function countMediaReferences(url: string, sources: MediaReferenceSource[]): number {
  const target = normalizeMediaUrl(url);
  if (!target) return 0;
  let count = 0;
  for (const source of sources) {
    for (const image of source.images || []) {
      if (normalizeMediaUrl(String(image || '')) === target) count += 1;
    }
    if (source.videoUrl && normalizeMediaUrl(source.videoUrl) === target) count += 1;
    if (source.html && source.html.includes(target)) count += 1;
  }
  return count;
}

export function canDeleteMediaAsset(referenceCount: number): boolean {
  return referenceCount === 0;
}

export function assertUrlsUnreferenced(urls: string[], sources: MediaReferenceSource[]): void {
  for (const url of urls) {
    if (!canDeleteMediaAsset(countMediaReferences(url, sources))) {
      throw new Error(`media still referenced: ${url}`);
    }
  }
}
