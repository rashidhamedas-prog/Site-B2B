'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import type { ThemePopupConfig, ThemeSettings } from './ThemeApply';

const DISMISS_PREFIX = 'taranom_popup_dismissed_';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
/** Past the wholesale hero band (~360px) so the bar does not sit on the hero. */
const SCROLL_PX = 360;
const SHOW_AFTER_MS = 12_000;

function wasDismissed(id: string): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_PREFIX + id);
    if (!raw) return false;
    if (raw === '1') return true;
    const until = Number(JSON.parse(raw)?.until);
    if (Number.isFinite(until) && until > Date.now()) return true;
    localStorage.removeItem(DISMISS_PREFIX + id);
    return false;
  } catch {
    return false;
  }
}

function dismiss(id: string) {
  try {
    localStorage.setItem(
      DISMISS_PREFIX + id,
      JSON.stringify({ until: Date.now() + DISMISS_MS }),
    );
  } catch {
    /* ignore */
  }
}

function NewsletterPopup({
  config,
  open,
  onClose,
}: {
  config: ThemePopupConfig;
  open: boolean;
  onClose: () => void;
}) {
  const handleClose = () => {
    dismiss('newsletter');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={config.title} size="md">
      <div className="space-y-5 px-6 py-5">
        <p className="text-sm leading-relaxed text-[var(--brand-muted,#4B5563)]">{config.body}</p>
        <div className="flex flex-wrap gap-3">
          <Link href={config.ctaUrl || '#'} onClick={handleClose} className="cursor-pointer">
            <Button variant="primary">{config.ctaLabel}</Button>
          </Link>
          <Button variant="glass" onClick={handleClose}>
            بعداً
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function BoutiqueBar({
  config,
  onClose,
}: {
  config: ThemePopupConfig;
  onClose: () => void;
}) {
  const handleClose = () => {
    dismiss('boutique');
    onClose();
  };

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--brand-border,#E8E0D4)] bg-[var(--brand-ivory,#F6F1E8)] shadow-[0_-8px_24px_rgba(15,47,40,0.12)]"
      aria-label={config.title}
    >
      <div className="container-site flex items-center gap-2 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:gap-3">
        <p className="min-w-0 flex-1 truncate text-sm font-extrabold text-[var(--brand-ink,#1A1A1A)]">
          {config.title}
        </p>
        <Link
          href={config.ctaUrl || '/portal/register'}
          onClick={handleClose}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-lg bg-[var(--brand-gold,#C9A84C)] px-3 text-sm font-bold text-[var(--brand-ink,#1A1A1A)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-ink,#1A1A1A)] sm:px-4"
        >
          {config.ctaLabel}
        </Link>
        <button
          type="button"
          onClick={handleClose}
          aria-label="بستن پیشنهاد همکاری"
          className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--brand-ink,#1A1A1A)] hover:bg-white/70"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </aside>
  );
}

/** Homepage lead prompts. Boutique is a bottom bar after scroll or delay, never a first-paint modal. */
export function LandingPopups({ theme }: { theme: ThemeSettings }) {
  const pathname = usePathname();
  const [barOpen, setBarOpen] = useState(false);
  const [newsletterOpen, setNewsletterOpen] = useState(false);
  const onHome = pathname === '/' || pathname === '';

  const tryNewsletter = useCallback((config: ThemePopupConfig) => {
    if (!config.enabled || wasDismissed('newsletter')) return;
    setNewsletterOpen(true);
  }, []);

  useEffect(() => {
    if (!barOpen) {
      document.documentElement.style.removeProperty('--wholesale-bottom-bar');
      return;
    }
    document.documentElement.style.setProperty('--wholesale-bottom-bar', '4.75rem');
    return () => {
      document.documentElement.style.removeProperty('--wholesale-bottom-bar');
    };
  }, [barOpen]);

  useEffect(() => {
    if (!onHome) return;

    const boutique = theme.popups.boutique;
    const newsletter = theme.popups.newsletter;
    const timers: number[] = [];
    const finePointer =
      typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

    let barArmed = false;
    const heroClearsBar = () => {
      const hero = document.querySelector('.wholesale-editorial-hero, .storefront-hero-frame');
      if (!hero) return window.scrollY >= SCROLL_PX;
      return hero.getBoundingClientRect().bottom < window.innerHeight - 88;
    };
    const openBar = () => {
      if (barArmed || !boutique?.enabled || wasDismissed('boutique')) return;
      if (!heroClearsBar()) return;
      barArmed = true;
      setBarOpen(true);
    };

    const onScroll = () => {
      if (window.scrollY >= SCROLL_PX) openBar();
    };
    const onExit = (e: MouseEvent) => {
      if (e.clientY > 24) return;
      if (newsletter?.enabled && newsletter.trigger === 'exit') tryNewsletter(newsletter);
    };

    if (boutique?.enabled && !wasDismissed('boutique')) {
      window.addEventListener('scroll', onScroll, { passive: true });
      timers.push(window.setTimeout(openBar, SHOW_AFTER_MS));
      if (window.scrollY >= SCROLL_PX) timers.push(window.setTimeout(openBar, 1500));
    }
    if (finePointer && newsletter?.enabled && newsletter.trigger === 'exit') {
      document.addEventListener('mouseout', onExit);
    }

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('scroll', onScroll);
      if (finePointer) document.removeEventListener('mouseout', onExit);
    };
  }, [theme, tryNewsletter, onHome]);

  if (!onHome) return null;

  const boutique = theme.popups.boutique;
  const newsletter = theme.popups.newsletter;

  return (
    <>
      {boutique && barOpen ? <BoutiqueBar config={boutique} onClose={() => setBarOpen(false)} /> : null}
      {newsletter ? (
        <NewsletterPopup
          config={newsletter}
          open={newsletterOpen}
          onClose={() => setNewsletterOpen(false)}
        />
      ) : null}
    </>
  );
}
