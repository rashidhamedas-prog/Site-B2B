import type { ContentBlock } from './types';

export function findBlock<T extends ContentBlock['type']>(
  blocks: ContentBlock[],
  type: T,
): ContentBlock | undefined {
  return blocks.find((b) => b.type === type);
}

export function str(props: Record<string, unknown>, key: string, fallback = ''): string {
  const v = props[key];
  return typeof v === 'string' ? v : fallback;
}

export function bool(props: Record<string, unknown>, key: string, fallback = true): boolean {
  const v = props[key];
  return typeof v === 'boolean' ? v : fallback;
}

export function arr<T>(props: Record<string, unknown>, key: string): T[] {
  return Array.isArray(props[key]) ? (props[key] as T[]) : [];
}
