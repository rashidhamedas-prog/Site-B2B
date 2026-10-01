import Image from 'next/image';

export type RetailProcessStep = {
  step?: string;
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
};

export function RetailProcessSteps({
  eyebrow,
  headline,
  body,
  steps,
}: {
  eyebrow?: string;
  headline?: string;
  body?: string;
  steps?: RetailProcessStep[];
}) {
  const list = (steps ?? []).filter((s) => s.title || s.description || s.image);
  if (!headline && !list.length) return null;

  return (
    <section
      className="relative overflow-hidden bg-[var(--retail-primary-dark,#0F2F28)] px-4 py-14 text-white sm:px-6 sm:py-16"
      aria-labelledby="retail-process-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(ellipse 55% 50% at 15% 20%, rgba(201,168,76,0.35), transparent 60%)',
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          {eyebrow ? (
            <p className="mb-2 text-sm font-semibold tracking-wide text-[var(--retail-accent,#C9A84C)]">
              {eyebrow}
            </p>
          ) : null}
          {headline ? (
            <h2 id="retail-process-heading" className="text-2xl font-extrabold sm:text-3xl">
              {headline}
            </h2>
          ) : null}
          {body ? <p className="mt-3 text-sm leading-7 text-white/70 sm:text-base">{body}</p> : null}
        </div>

        <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
          {list.map((item, index) => (
            <li key={`${item.step}-${item.title}-${index}`} className="relative text-center lg:text-right">
              {index < list.length - 1 ? (
                <span
                  className="pointer-events-none absolute left-0 top-10 z-0 hidden h-px w-full translate-x-1/2 bg-gradient-to-l from-transparent via-[var(--retail-accent,#C9A84C)]/35 to-[var(--retail-accent,#C9A84C)]/50 lg:block"
                  aria-hidden
                />
              ) : null}

              <div className="relative z-10 flex flex-col items-center gap-3 lg:items-start">
                {item.image ? (
                  <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/15 bg-white/5">
                    <Image
                      src={item.image}
                      alt={item.imageAlt || item.title || `مرحله ${item.step || index + 1}`}
                      width={160}
                      height={160}
                      className="h-full w-full object-contain p-2"
                      loading="lazy"
                      unoptimized={item.image.endsWith('.svg')}
                    />
                  </div>
                ) : (
                  <p className="font-mono text-3xl font-extrabold tracking-tight text-[var(--retail-accent,#C9A84C)]">
                    {item.step || String(index + 1).padStart(2, '0')}
                  </p>
                )}
                {item.step && item.image ? (
                  <p className="text-xs font-semibold tracking-wide text-[var(--retail-accent,#C9A84C)]">
                    مرحله {item.step}
                  </p>
                ) : null}
                {item.title ? <h3 className="text-base font-bold">{item.title}</h3> : null}
                {item.description ? (
                  <p className="text-sm leading-7 text-white/65">{item.description}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
