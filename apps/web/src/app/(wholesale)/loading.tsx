export default function WholesaleLoading() {
  return (
    <div className="bg-primary-dark min-h-[60vh] animate-pulse">
      <div className="h-[70vh] bg-black/20" />
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
        <div className="h-8 w-56 rounded bg-white/10" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-white/10" />
          ))}
        </div>
      </div>
    </div>
  );
}
