/**
 * Minimal OOXML (.xlsx) writer. Stored (uncompressed) ZIP — Excel accepts this.
 * No third-party spreadsheet dependency.
 */

export type ExcelCell = string | number | boolean | null | undefined;

export type ExcelSheet = {
  name: string;
  headers: string[];
  rows: ExcelCell[][];
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function colLetter(index0: number): string {
  let n = index0 + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function xmlEscape(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sheetName(raw: string, used: Set<string>): string {
  let name = String(raw || 'Sheet')
    .replace(/[:\\/?*\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31);
  if (!name) name = 'Sheet';
  let candidate = name;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` ${n}`;
    candidate = `${name.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function cellXml(col0: number, row1: number, value: ExcelCell): string {
  const ref = `${colLetter(col0)}${row1}`;
  if (value === null || value === undefined || value === '') {
    return `<c r="${ref}"/>`;
  }
  if (typeof value === 'boolean') {
    return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  const text = xmlEscape(String(value));
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
}

function columnWidths(headers: string[], rows: ExcelCell[][]): string {
  const widths = headers.map((h, i) => {
    let max = String(h || '').length;
    for (const row of rows) {
      const cell = row[i];
      const len = cell == null ? 0 : String(cell).length;
      if (len > max) max = len;
    }
    return Math.min(48, Math.max(10, max + 2));
  });
  return widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');
}

function worksheetXml(sheet: ExcelSheet): string {
  const colCount = Math.max(1, sheet.headers.length);
  const rowCount = sheet.rows.length + 1;
  const lastRef = `${colLetter(colCount - 1)}${rowCount}`;
  const headerCells = sheet.headers
    .map((h, i) => cellXml(i, 1, h))
    .join('');
  const body = sheet.rows
    .map((row, r) => {
      const cells = [];
      for (let c = 0; c < colCount; c++) {
        cells.push(cellXml(c, r + 2, row[c]));
      }
      return `<row r="${r + 2}">${cells.join('')}</row>`;
    })
    .join('');
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetViews><sheetView workbookViewId="0" rightToLeft="1">` +
    `<pane ySplit="1" topLeftCell="A2" activePane="bottomRight" state="frozen"/>` +
    `</sheetView></sheetViews>` +
    `<cols>${columnWidths(sheet.headers, sheet.rows)}</cols>` +
    `<sheetData><row r="1" s="1">${headerCells}</row>${body}</sheetData>` +
    `<autoFilter ref="A1:${lastRef}"/>` +
    `</worksheet>`
  );
}

function zipStore(files: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | (Math.floor(now.getSeconds() / 2) & 0x1f);
  const dosDate =
    ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const crc = crc32(file.data);
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);

    localParts.push(local, file.data);
    centralParts.push(central);
    offset += local.length + file.data.length;
  }

  const locals = Buffer.concat(localParts);
  const centrals = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centrals.length, 12);
  eocd.writeUInt32LE(locals.length, 16);
  return Buffer.concat([locals, centrals, eocd]);
}

export function buildXlsx(sheets: ExcelSheet[]): Buffer {
  if (!sheets.length) {
    throw new Error('at least one sheet is required');
  }
  const used = new Set<string>();
  const named = sheets.map((s) => ({ ...s, name: sheetName(s.name, used) }));

  const files: Array<{ name: string; data: Buffer }> = [
    {
      name: '[Content_Types].xml',
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          named
            .map(
              (_s, i) =>
                `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
            )
            .join('') +
          `</Types>`,
        'utf8',
      ),
    },
    {
      name: '_rels/.rels',
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
          `</Relationships>`,
        'utf8',
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          named
            .map(
              (_s, i) =>
                `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
            )
            .join('') +
          `</Relationships>`,
        'utf8',
      ),
    },
    {
      name: 'xl/workbook.xml',
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
          `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<sheets>` +
          named
            .map(
              (s, i) =>
                `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
            )
            .join('') +
          `</sheets></workbook>`,
        'utf8',
      ),
    },
  ];

  named.forEach((sheet, i) => {
    files.push({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: Buffer.from(worksheetXml(sheet), 'utf8'),
    });
  });

  return zipStore(files);
}

export function contentDispositionUtf8(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii || 'export.xlsx'}"; filename*=UTF-8''${encoded}`;
}
