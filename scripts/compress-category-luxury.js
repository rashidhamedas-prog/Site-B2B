const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const dir = path.join(
  __dirname,
  '../apps/web/public/banners/category-luxury-2026',
);

(async () => {
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.jpg'))) {
    const inP = path.join(dir, f);
    const outP = path.join(dir, f.replace(/\.jpg$/i, '.webp'));
    await sharp(inP).resize(1200, 1200, { fit: 'cover' }).webp({ quality: 82 }).toFile(outP);
    console.log(f, '->', path.basename(outP), fs.statSync(outP).size);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
