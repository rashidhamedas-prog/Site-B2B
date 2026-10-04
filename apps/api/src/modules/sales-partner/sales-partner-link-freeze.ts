import { EntityManager } from 'typeorm';
import {
  type CommissionRule,
  type CommissionScope,
  selectCommissionRule,
  snapshotLineCommissions,
} from './sales-commission-policy';

type SavedItem = { id: string; productVariantId: string; totalPrice: number | string };

/** Write commission snapshots inside the order transaction, using rules in force at that moment. */
export async function freezeSalesPartnerLinkSnapshots(
  manager: EntityManager,
  input: {
    orderId: string;
    salesPartnerId: string;
    productIds: string[];
    items: SavedItem[];
    orderDiscountIrr: number;
    walletAppliedIrr: number;
    at: Date;
  },
): Promise<void> {
  if (!input.productIds.length || !input.items.length) return;
  const variants: Array<{ id: string; productId: string; categoryId: string | null }> = await manager.query(
    `SELECT v.id, v."productId", p."categoryId"
     FROM product_variants v
     JOIN products p ON p.id = v."productId"
     WHERE v.id = ANY($1::uuid[])`,
    [input.items.map((item) => item.productVariantId)],
  );
  const byVariant = new Map(variants.map((row) => [row.id, row]));
  const clicked = new Set(input.productIds);
  const rules = await loadRules(manager);
  const lines = input.items.map((item) => {
    const variant = byVariant.get(item.productVariantId);
    const attributable = Boolean(variant && clicked.has(variant.productId));
    const rule = attributable
      ? selectCommissionRule(rules, {
        productId: variant!.productId,
        categoryId: variant!.categoryId,
        lineTotalAfterDiscountIrr: Math.max(0, Math.floor(Number(item.totalPrice || 0))),
      }, input.salesPartnerId, input.at)
      : null;
    return {
      orderItemId: item.id,
      lineTotalIrr: Math.max(0, Math.floor(Number(item.totalPrice || 0))),
      percent: rule?.percent ?? 0,
      ruleId: rule?.id ?? null,
      ruleVersion: rule?.version ?? 1,
      attributable,
    };
  });
  if (!lines.some((line) => line.attributable)) return;
  const computed = snapshotLineCommissions({
    lines,
    orderDiscountIrr: input.orderDiscountIrr,
    walletAppliedIrr: input.walletAppliedIrr,
  });
  for (const snap of computed) {
    const meta = lines.find((line) => line.orderItemId === snap.orderItemId);
    if (!meta?.attributable) continue;
    await manager.query(
      `INSERT INTO sales_commission_snapshots
        ("orderId", "orderItemId", "salesPartnerId", "ruleId", "ruleVersion", percent, "eligibleNetIrr", "commissionIrr")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT ("orderItemId") DO NOTHING`,
      [
        input.orderId,
        snap.orderItemId,
        input.salesPartnerId,
        meta?.ruleId ?? null,
        meta?.ruleVersion ?? 1,
        snap.percent,
        snap.eligibleNetIrr,
        snap.commissionIrr,
      ],
    );
  }
}

async function loadRules(manager: EntityManager): Promise<CommissionRule[]> {
  const rows: Array<{
    id: string;
    scope: CommissionScope;
    percent: number;
    active: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
    productId: string | null;
    categoryId: string | null;
    salesPartnerId: string | null;
    version: number;
  }> = await manager.query(
    `SELECT id, scope, percent, active, "startsAt", "endsAt", "productId", "categoryId", "salesPartnerId", version
     FROM sales_commission_rules WHERE active = true`,
  );
  return rows;
}
