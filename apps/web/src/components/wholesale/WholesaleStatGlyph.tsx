import type { WholesaleStatKind } from '@/lib/wholesale-stat-kind';

const EMERALD = '#1B5C4A';
const EMERALD_DARK = '#124035';
const EMERALD_MID = '#2D7A5F';
const GOLD = '#C9A84C';
const GOLD_LIGHT = '#E5C97C';
const CREAM = '#F7F4EA';

function Shadow() {
  return <ellipse cx="20" cy="35.2" rx="11" ry="2.2" fill={EMERALD_DARK} opacity="0.14" />;
}

function StorefrontGlyph() {
  return (
    <g>
      <path d="M8.5 16.5 20 10l11.5 6.5-11.5 6.2Z" fill={GOLD} />
      <path d="M8.5 16.5 20 22.7V33L8.5 26.6Z" fill={EMERALD} />
      <path d="M20 22.7 31.5 16.5V26.6L20 33Z" fill={EMERALD_DARK} />
      <path d="M11.4 19.4 20 14.6l8.6 4.8-8.6 4.6Z" fill={GOLD_LIGHT} />
      <path d="M13.2 23.2h4.2v6.4l-4.2-2.3Z" fill={CREAM} opacity="0.92" />
      <path d="M22.8 25.6 28.2 22.6v5.2l-5.4 3Z" fill={CREAM} opacity="0.55" />
    </g>
  );
}

function YearsGlyph() {
  return (
    <g>
      <path d="M10 14.2 20 8.6l10 5.6-10 5.5Z" fill={GOLD_LIGHT} />
      <path d="M10 14.2 20 19.7V31.2L10 25.6Z" fill={EMERALD_MID} />
      <path d="M20 19.7 30 14.2V25.6L20 31.2Z" fill={EMERALD} />
      <path d="M14.2 17.6 20 14.4l5.8 3.2-5.8 3.1Z" fill={CREAM} />
      <circle cx="20" cy="17.4" r="1.35" fill={GOLD} />
      <path d="M20 17.4v3.1" stroke={EMERALD_DARK} strokeWidth="1.15" strokeLinecap="round" />
      <path d="M20 17.4 22.4 16.1" stroke={GOLD} strokeWidth="1.05" strokeLinecap="round" />
    </g>
  );
}

function ModelsGlyph() {
  return (
    <g>
      <path d="M12.2 11.8h15.6" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M20 10.4v3.2" stroke={GOLD_LIGHT} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11.4 15.2 20 19.4V33.2L9.8 27.6Z" fill={EMERALD_MID} />
      <path d="M20 19.4 28.6 15.2 30.2 27.6 20 33.2Z" fill={EMERALD} />
      <path d="M13.6 15.4 20 19.2l6.4-3.8c-1.6 1.8-4 2.7-6.4 2.7s-4.8-.9-6.4-2.7Z" fill={GOLD_LIGHT} />
      <path d="M16.4 23.4 20 25.2v5.2l-3.6-2Z" fill={CREAM} opacity="0.5" />
    </g>
  );
}

function TeamGlyph() {
  return (
    <g>
      <ellipse cx="14.6" cy="13.2" rx="3.1" ry="2.1" fill={GOLD_LIGHT} />
      <path d="M11.2 16.2 14.6 14.4 18 16.2 14.6 18Z" fill={GOLD} />
      <path d="M11.2 16.2 14.6 18V27.2L10.4 25.2Z" fill={EMERALD_MID} />
      <path d="M14.6 18 18 16.2V25.2L14.6 27.2Z" fill={EMERALD} />
      <ellipse cx="25.6" cy="12.2" rx="3.1" ry="2.1" fill={GOLD_LIGHT} />
      <path d="M22.2 15.2 25.6 13.4 29 15.2 25.6 17Z" fill={GOLD} />
      <path d="M22.2 15.2 25.6 17V26.2L21.4 24.2Z" fill={EMERALD} />
      <path d="M25.6 17 29 15.2V24.2L25.6 26.2Z" fill={EMERALD_DARK} />
    </g>
  );
}

function DefaultGlyph() {
  return (
    <g>
      <path d="M20 8.8 30.4 14.6 20 20.2 9.6 14.6Z" fill={GOLD} />
      <path d="M9.6 14.6 20 20.2V31.4L9.6 25.6Z" fill={EMERALD} />
      <path d="M20 20.2 30.4 14.6V25.6L20 31.4Z" fill={EMERALD_DARK} />
      <path d="M20 12.6 26.2 16 20 19.2 13.8 16Z" fill={GOLD_LIGHT} />
    </g>
  );
}

function GlyphBody({ kind }: { kind: WholesaleStatKind }) {
  switch (kind) {
    case 'customers':
      return <StorefrontGlyph />;
    case 'years':
      return <YearsGlyph />;
    case 'models':
      return <ModelsGlyph />;
    case 'team':
      return <TeamGlyph />;
    default:
      return <DefaultGlyph />;
  }
}

export function WholesaleStatGlyph({ kind }: { kind: WholesaleStatKind }) {
  return (
    <span
      className="relative inline-flex h-9 w-10 shrink-0 items-center justify-center motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:group-hover:-translate-y-0.5"
      aria-hidden
    >
      <svg viewBox="0 0 40 40" className="h-9 w-10" focusable="false">
        <Shadow />
        <GlyphBody kind={kind} />
      </svg>
    </span>
  );
}
