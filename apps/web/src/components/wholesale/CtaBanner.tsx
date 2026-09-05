import Link from 'next/link';
import { Button } from '@/components/ui';
import { Phone, Send } from 'lucide-react';

export function CtaBanner({
  eyebrow = 'همکاری با تولیدی لباس',
  headline = 'بوتیک دارید؟ از کارگاه مشهد سفارش دهید',
  body = 'درخواست همکاری را بفرستید تا حساب بررسی شود. حداقل سفارش هر مدل از ۶ عدد است؛ قیمت عمده بعد از تأیید دیده می‌شود.',
  ctaLabel = 'درخواست همکاری',
  ctaHref = '/portal/register',
  ctaSecondaryLabel = 'تماس با فروش',
  ctaSecondaryHref = 'tel:09152424624',
  ctaTertiaryLabel = 'تلگرام',
  ctaTertiaryHref = 'https://t.me/toliditaranom',
}: {
  eyebrow?: string;
  headline?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
  ctaTertiaryLabel?: string;
  ctaTertiaryHref?: string;
}) {
  const isExternal = (href: string) =>
    href.startsWith('http') || href.startsWith('tel:') || href.startsWith('mailto:');

  const Action = ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) =>
    isExternal(href) ? (
      <a
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        className="cursor-pointer"
      >
        {children}
      </a>
    ) : (
      <Link href={href} className="cursor-pointer">
        {children}
      </Link>
    );

  return (
    <section className="relative overflow-hidden bg-gradient-brand section">
      <div className="bg-grain absolute inset-0" />
      <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />

      <div className="container-site relative text-center">
        <div className="glass-dark mx-auto max-w-2xl rounded-2xl px-6 py-10 sm:px-10 sm:py-12">
          {eyebrow ? (
            <p className="mb-3 text-sm font-semibold tracking-wide text-secondary-light">{eyebrow}</p>
          ) : null}
          {headline ? (
            <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {headline}
            </h2>
          ) : null}
          {body ? (
            <p className="mb-10 text-lg leading-relaxed text-white/80">{body}</p>
          ) : null}

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            {ctaLabel && ctaHref ? (
              <Action href={ctaHref}>
                <Button size="lg" variant="secondary" className="min-w-[180px]">
                  {ctaLabel}
                </Button>
              </Action>
            ) : null}

            {ctaSecondaryLabel && ctaSecondaryHref ? (
              <Action href={ctaSecondaryHref}>
                <Button
                  size="lg"
                  variant="glass"
                  className="min-w-[180px] border-white/40 text-white hover:text-primary"
                  rightIcon={<Phone className="h-5 w-5" />}
                >
                  {ctaSecondaryLabel}
                </Button>
              </Action>
            ) : null}

            {ctaTertiaryLabel && ctaTertiaryHref ? (
              <Action href={ctaTertiaryHref}>
                <Button
                  size="lg"
                  variant="ghost"
                  className="min-w-[180px] text-white hover:bg-white/10"
                  rightIcon={<Send className="h-5 w-5" />}
                >
                  {ctaTertiaryLabel}
                </Button>
              </Action>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
