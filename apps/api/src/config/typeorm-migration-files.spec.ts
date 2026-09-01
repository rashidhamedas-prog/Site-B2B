import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { compiledMigrationFiles } from './typeorm-migration-files';

const root = join(tmpdir(), `taranom-mig-files-${process.pid}`);
const dir = join(root, 'dist/database/migrations');

rmSync(root, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, '20260901-001-stock-commit-and-addresses.js'), 'exports.ok = 1;');
writeFileSync(join(dir, '20260829-003-torob-product-fields.spec.js'), 'throw new Error("spec");');
writeFileSync(join(dir, 'readme.md'), 'ignore');

const files = compiledMigrationFiles(root);
if (files.length !== 1) throw new Error(`expected 1 migration, got ${files.length}`);
if (!files[0].endsWith('20260901-001-stock-commit-and-addresses.js')) {
  throw new Error(`unexpected file ${files[0]}`);
}
if (compiledMigrationFiles(join(root, 'missing')).length !== 0) {
  throw new Error('missing dir should be empty');
}
rmSync(root, { recursive: true, force: true });
console.log('typeorm-migration-files.spec ok');
