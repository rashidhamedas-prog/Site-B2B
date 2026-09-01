import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const CANDIDATE_DIRS = [
  'dist/apps/api/src/database/migrations',
  'dist/database/migrations',
];

function listMigrationJs(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.js') && !name.endsWith('.spec.js'))
    .sort()
    .map((name) => join(dir, name));
}

/** Prefer the tsc emit path so relative migration imports keep working. */
export function compiledMigrationFiles(root = process.cwd()): string[] {
  for (const rel of CANDIDATE_DIRS) {
    const dir = join(root, rel);
    if (!existsSync(dir)) continue;
    const files = listMigrationJs(dir);
    if (files.length) return files;
  }
  return [];
}
