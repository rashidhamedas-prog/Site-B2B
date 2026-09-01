import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { compiledMigrationFiles } from './typeorm-migration-files';

const root = join(tmpdir(), `taranom-mig-files-${process.pid}`);
const nested = join(root, 'dist/apps/api/src/database/migrations');
const flat = join(root, 'dist/database/migrations');

rmSync(root, { recursive: true, force: true });
mkdirSync(nested, { recursive: true });
mkdirSync(flat, { recursive: true });
writeFileSync(join(nested, '20260901-001-stock-commit-and-addresses.js'), 'exports.ok = 1;');
writeFileSync(join(nested, '20260829-003-torob-product-fields.spec.js'), 'throw new Error("spec");');
writeFileSync(join(flat, 'flattened-only.js'), 'exports.flat = 1;');

const nestedFiles = compiledMigrationFiles(root);
if (nestedFiles.length !== 1) throw new Error(`expected 1 nested migration, got ${nestedFiles.length}`);
if (!nestedFiles[0].replace(/\\/g, '/').includes('dist/apps/api/src/database/migrations')) {
  throw new Error(`should prefer tsc emit path, got ${nestedFiles[0]}`);
}

rmSync(nested, { recursive: true, force: true });
const flatFiles = compiledMigrationFiles(root);
if (flatFiles.length !== 1 || !flatFiles[0].endsWith('flattened-only.js')) {
  throw new Error(`expected flattened fallback, got ${flatFiles.join(',')}`);
}

if (compiledMigrationFiles(join(root, 'missing')).length !== 0) {
  throw new Error('missing dir should be empty');
}
rmSync(root, { recursive: true, force: true });
console.log('typeorm-migration-files.spec ok');
