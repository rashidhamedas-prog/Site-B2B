const PUBLIC_STATUSES = new Set(['ACTIVE']);

export function resolvePublicProductStatus(status?: string | null): 'ACTIVE' {
  const requested = String(status || 'ACTIVE').toUpperCase();
  if (!PUBLIC_STATUSES.has(requested)) {
    throw new Error('PUBLIC_STATUS_FORBIDDEN');
  }
  return 'ACTIVE';
}

export function isPublicProductRow(status?: string | null): boolean {
  return String(status || '').toUpperCase() === 'ACTIVE';
}
