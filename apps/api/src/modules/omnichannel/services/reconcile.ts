export type ReconcileVisible = {
  id: string;
  channel: 'RETAIL' | 'WHOLESALE';
  updatedAt: string | Date;
};

export type ReconcilePublication = {
  sourceId: string;
  channel: string;
  status: string;
  sourceUpdatedAt: string | Date;
};

export type ReconcileIntent = {
  action: 'create' | 'withdraw';
  sourceId: string;
  channel: string;
};

function key(sourceId: string, channel: string) {
  return `${sourceId}:${channel}`;
}

function time(value: string | Date): number {
  return new Date(value).getTime();
}

/** Compare visible catalog vs stored publications. Never invent delivery rows. */
export function reconcilePublicationIntents(
  visible: ReconcileVisible[],
  existing: ReconcilePublication[],
): ReconcileIntent[] {
  const intents: ReconcileIntent[] = [];
  const byKey = new Map(existing.map((row) => [key(row.sourceId, row.channel), row]));

  for (const item of visible) {
    const row = byKey.get(key(item.id, item.channel));
    if (!row || row.status === 'WITHDRAWN' || row.status === 'FAILED') {
      intents.push({ action: 'create', sourceId: item.id, channel: item.channel });
      continue;
    }
    if (time(row.sourceUpdatedAt) < time(item.updatedAt)) {
      intents.push({ action: 'create', sourceId: item.id, channel: item.channel });
    }
  }

  for (const row of existing) {
    if (row.status === 'WITHDRAWN') continue;
    const still = visible.some((item) => item.id === row.sourceId && item.channel === row.channel);
    if (!still) {
      intents.push({ action: 'withdraw', sourceId: row.sourceId, channel: row.channel });
    }
  }
  return intents;
}

/** Second pass against the state the first pass would produce must be empty. */
export function applyReconcileIntents(
  visible: ReconcileVisible[],
  existing: ReconcilePublication[],
  now: Date = new Date(),
): ReconcilePublication[] {
  const next = existing.map((row) => ({ ...row }));
  for (const intent of reconcilePublicationIntents(visible, existing)) {
    if (intent.action === 'withdraw') {
      for (const row of next) {
        if (row.sourceId === intent.sourceId && row.channel === intent.channel) row.status = 'WITHDRAWN';
      }
    } else {
      const row = next.find((item) => item.sourceId === intent.sourceId && item.channel === intent.channel);
      if (row) {
        row.status = 'DRAFT';
        row.sourceUpdatedAt = now;
      } else {
        next.push({
          sourceId: intent.sourceId,
          channel: intent.channel,
          status: 'DRAFT',
          sourceUpdatedAt: now,
        });
      }
    }
  }
  return next;
}
