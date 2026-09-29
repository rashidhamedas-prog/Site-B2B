export type WholesaleColorPromptTone = 'need' | 'ready';

export type WholesaleColorPrompt = {
  tone: WholesaleColorPromptTone;
  title: string;
  body: string;
};

/** Copy for wholesale pack color selection (B2B order step). */
export function wholesaleColorSelectPrompt(
  minColors: number,
  selectedCount: number,
): WholesaleColorPrompt {
  const min = Math.max(1, Math.floor(Number(minColors)) || 1);
  const selected = Math.max(0, Math.floor(Number(selectedCount)) || 0);
  const minFa = min.toLocaleString('fa-IR');
  const selectedFa = selected.toLocaleString('fa-IR');

  if (selected < min) {
    const remaining = min - selected;
    const remainingFa = remaining.toLocaleString('fa-IR');
    return {
      tone: 'need',
      title: 'رنگ‌های موردنظرتان را انتخاب کنید',
      body:
        selected === 0
          ? `روی رنگ‌هایی که می‌خواهید در پک باشد بزنید. حداقل ${minFa} رنگ لازم است؛ هر پک = رنگ‌های انتخابی × همه سایزها.`
          : `${selectedFa} رنگ انتخاب شده — برای ساخت پک، ${remainingFa} رنگ دیگر انتخاب کنید.`,
    };
  }

  return {
    tone: 'ready',
    title: 'رنگ‌های پک آماده است',
    body: `${selectedFa} رنگ انتخاب شد. تعداد پک را تنظیم کنید و به سبد اضافه کنید.`,
  };
}
