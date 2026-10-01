import {
  Package,
  Shield,
  Link2,
  Wallet,
  Truck,
  Headphones,
  CreditCard,
  Zap,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Package,
  Shield,
  Link2,
  Wallet,
  Truck,
  Headphones,
  CreditCard,
  Zap,
};

export type RetailFeatureItem = {
  icon?: string;
  title: string;
  description: string;
};

export function RetailFeatureCards({
  eyebrow,
  headline,
  body,
  items,
}: {
  eyebrow?: string;
  headline?: string;
  body?: string;
  items?: RetailFeatureItem[];
}) {
  const list = (items ?? []).filter((item) => item.title || item.description);
  if (!headline && !list.length) return null;

  return (
    <section className="bg-[var(--retail-bg)] px-4 py-14 sm:px-6 sm:py-16" aria-labelledby="retail-features-heading">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          {eyebrow ? (
            <p className="mb-2 text-sm font-semibold tracking-wide text-[var(--retail-accent,#C9A84C)]">
              {eyebrow}
            </p>
          ) : null}
          {headline ? (
            <h2
              id="retail-features-heading"
              className="text-2xl font-extrabold tracking-tight text-[var(--retail-ink,#0F2F28)] sm:text-3xl"
            >
              {headline}
            </h2>
          ) : null}
          {body ? (
            <p className="mt-3 text-sm leading-7 text-[var(--retail-muted,#5C6B66)] sm:text-base">
              {body}
            </p>
          ) : null}
        </div>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((item) => {
            const Icon = ICON_MAP[item.icon || ''] || Package;
            return (
              <li
                key={item.title}
                className="rounded-2xl border border-[var(--retail-border,#E8E2D9)] bg-white p-5 text-right shadow-[0_1px_0_rgba(15,47,40,0.04)]"
              >
                <span
                  className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--retail-primary,#1B5C4A)]/10 text-[var(--retail-primary,#1B5C4A)]"
                  aria-hidden
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                {item.title ? (
                  <h3 className="text-base font-bold text-[var(--retail-ink,#0F2F28)]">{item.title}</h3>
                ) : null}
                {item.description ? (
                  <p className="mt-2 text-sm leading-7 text-[var(--retail-muted,#5C6B66)]">
                    {item.description}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
