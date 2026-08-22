import Link from 'next/link';
import type { ReactNode } from 'react';

function isExternal(href: string) {
  return href.startsWith('http') || href.startsWith('tel:') || href.startsWith('mailto:');
}

function Action({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  if (isExternal(href)) {
    return (
      <a
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/** Forest/gold home CTA — CMS-driven, no wholesale chrome. */
export function RetailCtaBanner({
  eyebrow,
  headline,
  body,
  ctaLabel,
  ctaHref,
  ctaSecondaryLabel,
  ctaSecondaryHref,
}: {
  eyebrow?: string;
  headline?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
}) {
  if (!headline && !ctaLabel) return null;

  return (
    <section className="relative overflow-hidden bg-[var(--retail-primary-dark)] px-4 py-16 text-white sm:px-6 sm:py-20">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          background:
            'radial-gradient(ellipse 50% 70% at 80% 20%, rgba(201,168,76,0.55), transparent 60%)',
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-2xl text-center">
        {eyebrow ? (
          <p className="mb-3 text-[11px] font-semibold tracking-[0.2em] text-[var(--retail-gold)]">
            {eyebrow}
          </p>
        ) : null}
        {headline ? (
          <h2 className="text-2xl font-extrabold leading-snug sm:text-3xl">{headline}</h2>
        ) : null}
        {body ? (
          <p className="mx-auto mt-4 max-w-lg text-sm leading-8 text-white/75">{body}</p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {ctaLabel && ctaHref ? (
            <Action
              href={ctaHref}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-md bg-gradient-to-l from-[#A88530] to-[var(--retail-gold)] px-7 text-sm font-extrabold text-[#1a1a1a] transition duration-200 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--retail-gold)]"
            >
              {ctaLabel}
            </Action>
          ) : null}
          {ctaSecondaryLabel && ctaSecondaryHref ? (
            <Action
              href={ctaSecondaryHref}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-md border border-[var(--retail-gold)]/60 px-7 text-sm font-bold text-[var(--retail-gold)] transition duration-200 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--retail-gold)]"
            >
              {ctaSecondaryLabel}
            </Action>
          ) : null}
        </div>
      </div>
    </section>
  );
}
