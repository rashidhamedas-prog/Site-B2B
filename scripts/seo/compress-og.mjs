// One-shot: compress the static OG images to 1200x630 (social preview size).
// Originals are backed up in .seo-baseline/og-backup/ before running.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const sharp = require('../../apps/api/node_modules/sharp');

for (const name of ['og-retail', 'og-wholesale']) {
  const src = `apps/web/public/${name}.jpg`;
  const buf = await sharp(src)
    .resize(1200, 630, { fit: 'cover' })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  writeFileSync(src, buf);
  console.log(name, buf.length);
}
