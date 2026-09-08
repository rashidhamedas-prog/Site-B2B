import { Pause, Play } from 'lucide-react';

export function NewsTicker({
  items,
  tone = 'forest',
}: {
  items: string[];
  tone?: 'forest' | 'ink';
}) {
  const clean = items.map((item) => item.trim()).filter(Boolean);
  if (clean.length === 0) return null;

  const loop = clean.length === 1 ? [clean[0]!, clean[0]!] : clean;
  const track = [...loop, ...loop];
  const pauseId = 'storefront-news-ticker-pause';
  const bg = tone === 'ink' ? 'bg-[#0b0f0e]' : 'bg-[#0f2f28]';

  return (
    <div
      className={`news-ticker ${bg}`}
      role="region"
      aria-label="نوار اطلاع‌رسانی"
    >
      <p className="sr-only">{clean.join(' — ')}</p>
      <div className="news-ticker-track min-w-0 flex-1 ps-12" aria-hidden="true">
        {track.map((item, index) => (
          <span key={`${item}-${index}`} className="news-ticker-item">
            {item}
          </span>
        ))}
      </div>
      <label
        htmlFor={pauseId}
        className="absolute start-2 top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-black/25 text-white backdrop-blur-sm transition-colors duration-200 hover:bg-black/40 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#c9a84c]"
      >
        <input id={pauseId} type="checkbox" className="news-ticker-pause peer sr-only" />
        <Pause className="h-3.5 w-3.5 peer-checked:hidden" aria-hidden />
        <Play className="hidden h-3.5 w-3.5 peer-checked:block" aria-hidden />
        <span className="sr-only">توقف یا ادامه حرکت نوار</span>
      </label>
    </div>
  );
}
