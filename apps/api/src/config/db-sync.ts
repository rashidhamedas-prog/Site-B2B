export function isProductionEnv(nodeEnv?: string | null): boolean {
  return String(nodeEnv || '').trim().toLowerCase() === 'production';
}

export function isProtectedRuntime(env: {
  NODE_ENV?: string | null;
  APP_ENV?: string | null;
}): boolean {
  const node = String(env.NODE_ENV || '').trim().toLowerCase();
  const app = String(env.APP_ENV || '').trim().toLowerCase();
  return node === 'production' || app === 'production' || app === 'staging';
}

export function isDbSyncRequested(dbSync?: string | null): boolean {
  return String(dbSync || '').trim().toLowerCase() === 'true';
}

/** Production and staging must never start with TypeORM synchronize. */
export function assertProductionDbSyncSafe(env: {
  NODE_ENV?: string | null;
  APP_ENV?: string | null;
  DB_SYNC?: string | null;
}): void {
  if (isProtectedRuntime(env) && isDbSyncRequested(env.DB_SYNC)) {
    throw new Error('DB_SYNC=true is forbidden in production/staging');
  }
}

export function typeormSynchronizeEnabled(env: {
  NODE_ENV?: string | null;
  APP_ENV?: string | null;
  DB_SYNC?: string | null;
}): boolean {
  assertProductionDbSyncSafe(env);
  return !isProtectedRuntime(env);
}
