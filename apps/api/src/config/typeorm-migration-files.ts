import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

/** TypeORM globs must not load compiled `*.spec.js` as migrations. */
export function compiledMigrationFiles(root = process.cwd()): string[] {
  const dir = join(root, 'dist/database/migrations');
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((name) => name.endsWith('.js') && !name.endsWith('.spec.js'))
    .map((name) => join(dir, name));
}
