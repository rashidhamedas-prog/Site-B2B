export function BlogHowTo({
  howTo,
  tone = 'wholesale',
}: {
  howTo: {
    name: string;
    description?: string;
    totalTime?: string;
    steps?: Array<{ title: string; description: string; sortOrder?: number }>;
  } | null | undefined;
  tone?: 'wholesale' | 'retail';
}) {
  if (!howTo?.name || !howTo.steps?.length) return null;
  const steps = [...howTo.steps].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const card =
    tone === 'retail'
      ? 'mt-10 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8'
      : 'card mt-10 p-6 sm:p-8';

  return (
    <section className={card}>
      <h2 className="mb-2 text-base font-bold">{howTo.name}</h2>
      {howTo.description && <p className="mb-4 text-sm text-gray-600">{howTo.description}</p>}
      {howTo.totalTime && (
        <p className="mb-4 text-xs text-gray-400">زمان تقریبی: {howTo.totalTime}</p>
      )}
      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {(i + 1).toLocaleString('fa-IR')}
            </span>
            <div>
              <h3 className="text-sm font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{s.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HowToJsonLd({ howTo }: { howTo: Record<string, unknown> | null }) {
  if (!howTo) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(howTo) }}
    />
  );
}
