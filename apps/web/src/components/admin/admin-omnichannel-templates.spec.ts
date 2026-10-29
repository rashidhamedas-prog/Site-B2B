/**
 * npx tsx apps/web/src/components/admin/admin-omnichannel-templates.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { templateActivateVisible } from './admin-omnichannel-templates';

const src = readFileSync(join(__dirname, 'admin-omnichannel-templates.tsx'), 'utf8');
const admin = readFileSync(join(__dirname, 'AdminOmnichannel.tsx'), 'utf8');

assert.equal(templateActivateVisible('OWNER'), true);
assert.equal(templateActivateVisible('PUBLISHER'), false);
assert.equal(templateActivateVisible('VIEWER'), false);
assert.match(src, /ضد\s*\*?\s*آب|ضدآب/);
assert.match(src, /activate/);
assert.match(src, /goRef/);
assert.match(admin, /AdminOmnichannelTemplates/);
assert.match(admin, /templatesUi|قالب‌ها/);

console.log('admin-omnichannel-templates.spec.ts OK');
