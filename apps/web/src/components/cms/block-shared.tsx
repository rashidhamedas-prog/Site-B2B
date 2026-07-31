import Link from 'next/link';
import type { ReactNode } from 'react';
import { MapPin, Phone, Send, Instagram, type LucideIcon } from 'lucide-react';
import type { ContentBlock } from '@/lib/cms/types';
import { arr, str } from '@/lib/cms/fetch';

const CONTACT_ICONS: Record<string, LucideIcon> = {
  Phone,
  Send,
  Instagram,
  MapPin,
};

export function TextBlock({ headline, body }: { headline?: string; body?: string }) {
  if (!headline && !body) return null;
  return (
    <section className="container-site py-12 lg:py-16">
      {headline ? (
        <h2 className="mb-4 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
          {headline}
        </h2>
      ) : null}
      {body
        ? body.split('\n\n').map((para, i) => (
            <p key={i} className="mb-4 leading-relaxed text-gray-600 whitespace-pre-line">
              {para}
            </p>
          ))
        : null}
    </section>
  );
}

export function ContactBlock({ props }: { props: Record<string, unknown> }) {
  const headline = str(props, 'headline');
  const channels = arr<{ icon?: string; title?: string; value?: string; href?: string }>(
    props,
    'channels',
  );
  const hours = arr<{ day?: string; time?: string }>(props, 'hours');
  const locations = arr<{ title?: string; address?: string; note?: string }>(props, 'locations');

  return (
    <section className="container-site space-y-12 py-12 lg:py-16">
      {headline ? (
        <h2 className="text-center text-2xl font-extrabold tracking-tight text-gray-900">
          {headline}
        </h2>
      ) : null}

      {channels.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {channels.map((ch, i) => {
            const Icon = CONTACT_ICONS[ch.icon || 'Phone'] || Phone;
            const inner = (
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-5 text-center transition hover:shadow-md">
                <Icon className="mx-auto mb-3 h-6 w-6 text-primary" />
                <p className="text-sm font-bold text-gray-900">{ch.title}</p>
                <p className="mt-1 text-sm text-gray-600" dir="auto">
                  {ch.value}
                </p>
              </div>
            );
            return ch.href ? (
              <a
                key={i}
                href={ch.href}
                className="cursor-pointer"
                target={ch.href.startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
              >
                {inner}
              </a>
            ) : (
              <div key={i}>{inner}</div>
            );
          })}
        </div>
      ) : null}

      {hours.length > 0 ? (
        <div className="mx-auto max-w-md rounded-2xl border border-[color:var(--color-border)] bg-white p-6">
          <h3 className="mb-4 text-center text-sm font-bold text-gray-900">ساعات کاری</h3>
          <ul className="space-y-2">
            {hours.map((h, i) => (
              <li key={i} className="flex justify-between text-sm text-gray-600">
                <span>{h.day}</span>
                <span className="font-medium text-gray-900">{h.time}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {locations.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {locations.map((loc, i) => (
            <div
              key={i}
              className="space-y-3 border border-[color:var(--color-border)] bg-white p-6"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-bold text-gray-900">{loc.title}</h3>
              </div>
              <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-line">
                {loc.address}
              </p>
              {loc.note ? <p className="text-xs text-gray-400">{loc.note}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function LinksBlock({ props }: { props: Record<string, unknown> }) {
  const headline = str(props, 'headline');
  const items = arr<{ label?: string; href?: string }>(props, 'items');
  if (!items.length) return null;
  return (
    <section className="container-site py-10">
      {headline ? <h2 className="mb-4 text-xl font-bold text-gray-900">{headline}</h2> : null}
      <ul className="space-y-2">
        {items.map((item, i) =>
          item.href && item.label ? (
            <li key={i}>
              <Link href={item.href} className="cursor-pointer text-primary hover:underline">
                {item.label}
              </Link>
            </li>
          ) : null,
        )}
      </ul>
    </section>
  );
}

export function filterChromeBlocks(blocks: ContentBlock[], skipChrome: boolean) {
  return skipChrome
    ? blocks.filter((b) => b.type !== 'chrome' && b.type !== 'announcement')
    : blocks;
}

export function heroPropsFromBlock(p: Record<string, unknown>) {
  const autoplayRaw = p.autoplayMs;
  const autoplayMs =
    typeof autoplayRaw === 'number'
      ? autoplayRaw
      : typeof autoplayRaw === 'string' && autoplayRaw.trim() !== ''
        ? Number(autoplayRaw)
        : undefined;
  const slides = Array.isArray(p.slides) ? (p.slides as unknown[]) : undefined;
  return {
    brandEyebrow: str(p, 'brandEyebrow') || undefined,
    headline: str(p, 'headline') || undefined,
    headlineAccent: str(p, 'headlineAccent') || undefined,
    body: str(p, 'body') || undefined,
    imageUrl: str(p, 'imageUrl') || undefined,
    ctaLabel: str(p, 'ctaLabel') || undefined,
    ctaHref: str(p, 'ctaHref') || undefined,
    ctaSecondaryLabel: str(p, 'ctaSecondaryLabel') || undefined,
    ctaSecondaryHref: str(p, 'ctaSecondaryHref') || undefined,
    slides,
    autoplayMs: Number.isFinite(autoplayMs) ? autoplayMs : undefined,
  };
}

export function pushCommonBlocks(
  block: ContentBlock,
  p: Record<string, unknown>,
  nodes: ReactNode[],
) {
  switch (block.type) {
    case 'text':
      nodes.push(<TextBlock key={block.id} headline={str(p, 'headline')} body={str(p, 'body')} />);
      break;
    case 'html':
      nodes.push(
        <section
          key={block.id}
          className="container-site prose prose-sm max-w-none py-10"
          dangerouslySetInnerHTML={{ __html: str(p, 'body') }}
        />,
      );
      break;
    case 'image':
      nodes.push(
        <section key={block.id} className="container-site py-10">
          {str(p, 'imageUrl') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={str(p, 'imageUrl')}
              alt={str(p, 'body') || ''}
              className="mx-auto max-h-[480px] w-full max-w-4xl rounded-2xl object-cover"
            />
          ) : null}
          {str(p, 'body') ? (
            <p className="mt-3 text-center text-sm text-gray-500">{str(p, 'body')}</p>
          ) : null}
        </section>,
      );
      break;
    case 'gallery': {
      const items = arr<{ imageUrl?: string; body?: string }>(p, 'items');
      nodes.push(
        <section
          key={block.id}
          className="container-site grid gap-4 py-10 sm:grid-cols-2 lg:grid-cols-3"
        >
          {items.map((item, i) =>
            item.imageUrl ? (
              <figure key={i} className="overflow-hidden rounded-2xl border border-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.body || ''}
                  className="aspect-square w-full object-cover"
                />
                {item.body ? (
                  <figcaption className="p-3 text-sm text-gray-600">{item.body}</figcaption>
                ) : null}
              </figure>
            ) : null,
          )}
        </section>,
      );
      break;
    }
    case 'contact':
      nodes.push(<ContactBlock key={block.id} props={p} />);
      break;
    case 'links':
      nodes.push(<LinksBlock key={block.id} props={p} />);
      break;
    default:
      break;
  }
}
