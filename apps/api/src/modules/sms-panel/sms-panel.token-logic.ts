import { createHash, randomBytes } from 'crypto';

export function payloadHashLike(parts: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

export function tokenFlow(input: {
  campaignId: string;
  audienceSnapshotHash: string;
  body: string;
  scheduledAt: string | null;
}) {
  const raw = randomBytes(24).toString('hex');
  const hash = createHash('sha256').update(raw).digest('hex');
  const payload = {
    campaignId: input.campaignId,
    audienceSnapshotHash: input.audienceSnapshotHash,
    body: input.body,
    scheduledAt: input.scheduledAt,
  };
  const expected = payloadHashLike(payload);
  return {
    raw,
    hash,
    payload,
    expected,
    stale: (other: typeof payload) => payloadHashLike(other) !== expected,
  };
}

export function confirmationTokenActive(
  conf: { usedAt: Date | null; expiresAt: Date },
  now = Date.now(),
): boolean {
  return !conf.usedAt && conf.expiresAt.getTime() >= now;
}
