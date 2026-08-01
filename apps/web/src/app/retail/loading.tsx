export default function RetailLoading() {
  return (
    <div className="min-h-[60vh] animate-pulse bg-[var(--retail-bg)]">
      <div className="h-[70vh] bg-[var(--retail-primary-dark)]/80" />
      <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-10 sm:px-6">
        <div className="h-8 w-48 rounded bg-[var(--retail-border)]/50" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] rounded-lg bg-[var(--retail-border)]/40" />
          ))}
        </div>
        <div className="h-72 rounded-xl bg-[var(--retail-border)]/40" />
      </div>
    </div>
  );
}
