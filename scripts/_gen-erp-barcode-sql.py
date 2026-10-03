import json
import re
from pathlib import Path

src = json.loads(Path(r"D:/proje/erp-taranom1/.tmp-sku-compare-erp.json").read_text(encoding="utf-8"))
rows = []
for b in src.get("barcodes") or []:
    code = str(b.get("code") or "").strip()
    barcode = str(b.get("barcode") or "").strip()
    vs = str(b.get("variant_sku") or "").strip()
    if not code or not barcode or not vs.startswith(code + "-"):
        continue
    rest = vs[len(code) + 1 :]
    if "-" not in rest:
        continue
    color, size = rest.rsplit("-", 1)
    color = color.strip()
    size = re.sub(r"\s*\(.*\)\s*$", "", size).strip()
    if not color or not size:
        continue
    rows.append((barcode.replace("'", "''"), code.replace("'", "''"), color.replace("'", "''"), size.replace("'", "''")))

lines = ["BEGIN;"]
for barcode, code, color, size in rows:
    lines.append(
        'UPDATE product_variants v SET barcode = \'{0}\' FROM products p '
        'WHERE v."productId" = p.id AND p.sku = \'{1}\' AND p."deletedAt" IS NULL '
        "AND v.color = '{2}' AND regexp_replace(v.size, E'\\\\s*\\\\(.*\\\\)\\\\s*$', '') = '{3}';".format(
            barcode, code, color, size
        )
    )
lines.append("COMMIT;")
lines.append(
    "SELECT COUNT(*) FILTER (WHERE barcode IS NOT NULL AND barcode <> '') AS filled FROM product_variants;"
)
out = Path(r"D:/proje/Site B2B/scripts/_align-erp-variant-barcodes.sql")
out.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("rows", len(rows), "bytes", out.stat().st_size)
