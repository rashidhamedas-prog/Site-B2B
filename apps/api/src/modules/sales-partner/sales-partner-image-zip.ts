import { sanitizeObjectKey } from '../upload/storage-delete';

const OWNED_HOST = /(^|\.)poshaktaranom\.(com|ir)$|^localhost$|^127\.0\.0\.1$|^minio$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
const MAX_ZIP_FILES = 6;

/** CRC-32 (ISO 3309) for ZIP local headers. */
export function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i]!;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (~crc) >>> 0;
}

/**
 * Uncompressed ZIP. Product images are already JPEG/WebP, so STORE avoids a zip dependency.
 * Filenames must be ASCII.
 */
export function storeZip(files: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files.slice(0, MAX_ZIP_FILES)) {
    const name = Buffer.from(file.name, 'ascii');
    const crc = crc32(file.data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    locals.push(local, file.data);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + file.data.length;
  }
  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(centrals.length, 8);
  end.writeUInt16LE(centrals.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralDir, end]);
}

/** Map a catalog image URL to an owned object key. External and traversal paths are rejected. */
export function partnerImageObjectKey(raw: string): string | null {
  const value = String(raw || '').trim();
  if (!value || value.length > 500) return null;
  let path = value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    if (!/^https?:\/\//i.test(value)) return null;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    if (url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (!OWNED_HOST.test(host)) return null;
    if (url.protocol === 'http:' && host !== 'localhost' && host !== '127.0.0.1' && host !== 'minio') return null;
    path = url.pathname;
  }
  const media = path.match(/\/media\/([^?#]+)$/);
  const rooted = path.match(/\/((?:products|blog)\/[^?#]+)$/);
  const bare = /^(?:products|blog)\//.test(path) ? path.split('?')[0] : null;
  const key = sanitizeObjectKey(media?.[1] || rooted?.[1] || bare);
  if (!key || !IMAGE_EXT.test(key)) return null;
  return key;
}

export function partnerImageEntryName(key: string, index: number): string {
  const ext = key.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || 'jpg';
  const safeExt = ext === 'jpeg' || ext === 'jpg' || ext === 'png' || ext === 'webp' || ext === 'gif' ? ext : 'jpg';
  return `${String(index + 1).padStart(2, '0')}.${safeExt}`;
}

export function partnerImageZipName(slug: string | null | undefined): string {
  const safe = String(slug || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${safe || 'product'}-images.zip`;
}
