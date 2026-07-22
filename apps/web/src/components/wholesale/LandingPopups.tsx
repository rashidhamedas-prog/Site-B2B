'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Modal, Button, Input } from '@/components/ui';
import type { ThemePopupConfig, ThemeSettings } from './ThemeApply';

const DISMISS_PREFIX = 'taranom_popup_dismissed_';

function wasDismissed(id: string): boolean {
  try {
    return localStorage.getItem(DISMISS_PREFIX + id) === '1';
  } catch {
    return false;
  }
}

function dismiss(id: string) {
  try {
    localStorage.setItem(DISMISS_PREFIX + id, '1');
  } catch {
    /* ignore */
  }
}

type PopupId = 'boutique' | 'newsletter';

function GlassPopup({
  id,
  config,
  open,
  onClose,
}: {
  id: PopupId;
  config: ThemePopupConfig;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handleClose = () => {
    dismiss(id);
    onClose();
  };

  const leadHref =
    id === 'boutique' && (name.trim() || phone.trim())
      ? `${config.ctaUrl}${config.ctaUrl.includes('?') ? '&' : '?'}name=${encodeURIComponent(name.trim())}&phone=${encodeURIComponent(phone.trim())}`
      : config.ctaUrl || '#';

  return (
    <Modal open={open} onClose={handleClose} title={config.title} size="md">
      <div className="space-y-5 px-6 py-5">
        <p className="text-sm leading-relaxed text-gray-600">{config.body}</p>

        {id === 'boutique' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="نام بوتیک / فروشگاه"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="موبایل"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link href={leadHref} onClick={handleClose} className="cursor-pointer">
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

/** Landing popups — homepage only; boutique after delay, newsletter on exit-intent. */
export function LandingPopups({ theme }: { theme: ThemeSettings }) {
  const pathname = usePathname();
  const [active, setActive] = useState<PopupId | null>(null);
  const onHome = pathname === '/' || pathname === '';

  const tryOpen = useCallback((id: PopupId, config: ThemePopupConfig) => {
    if (!config.enabled || wasDismissed(id)) return;
    setActive((prev) => prev ?? id);
  }, []);

  useEffect(() => {
    if (!onHome) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const order: PopupId[] = ['boutique', 'newsletter'];

    for (const id of order) {
      const config = theme.popups[id];
      if (!config?.enabled || wasDismissed(id)) continue;

      if (config.trigger === 'delay') {
        timers.push(
          setTimeout(() => tryOpen(id, config), Math.max(1, config.delaySeconds) * 1000),
        );
      }
    }

    const onExit = (e: MouseEvent) => {
      if (e.clientY > 24) return;
      for (const id of order) {
        const config = theme.popups[id];
        if (config?.enabled && config.trigger === 'exit' && !wasDismissed(id)) {
          tryOpen(id, config);
          break;
        }
      }
    };

    document.addEventListener('mouseout', onExit);
    return () => {
      timers.forEach(clearTimeout);
      document.removeEventListener('mouseout', onExit);
    };
  }, [theme, tryOpen, onHome]);

  if (!onHome) return null;

  const close = () => setActive(null);
  const boutique = theme.popups.boutique;
  const newsletter = theme.popups.newsletter;

  return (
    <>
      {boutique && (
        <GlassPopup
          id="boutique"
          config={boutique}
          open={active === 'boutique'}
          onClose={close}
        />
      )}
      {newsletter && (
        <GlassPopup
          id="newsletter"
          config={newsletter}
          open={active === 'newsletter'}
          onClose={close}
        />
      )}
    </>
  );
}
