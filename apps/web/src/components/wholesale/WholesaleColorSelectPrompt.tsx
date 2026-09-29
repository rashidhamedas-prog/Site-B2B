import { wholesaleColorSelectPrompt } from '@/lib/wholesale-color-prompt';

export function WholesaleColorSelectPrompt({
  minColors,
  selectedCount,
}: {
  minColors: number;
  selectedCount: number;
}) {
  const prompt = wholesaleColorSelectPrompt(minColors, selectedCount);
  const need = prompt.tone === 'need';

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        need
          ? 'rounded-xl border border-[var(--brand-gold,#C9A84C)] bg-[color-mix(in_srgb,var(--brand-gold,#C9A84C)_14%,white)] px-3 py-3 text-[var(--brand-ink)] shadow-sm'
          : 'rounded-xl border border-[var(--brand-green)]/30 bg-[var(--brand-green)]/5 px-3 py-3 text-[var(--brand-ink)]'
      }
    >
      <p className="text-sm font-bold leading-snug">{prompt.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--brand-muted)] sm:text-[13px]">{prompt.body}</p>
    </div>
  );
}
