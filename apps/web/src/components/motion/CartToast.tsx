'use client';

import { useEffect, useState } from 'react';

const EVENT = 'taranom:cart-added';

export function notifyCartAdded(name?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { name: name?.trim() ?? '' } }));
}

export function CartToast() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    let hideTimer = 0;
    const onAdd = (event: Event) => {
      const name = (event as CustomEvent<{ name?: string }>).detail?.name;
      setMessage(name ? `${name} به سبد اضافه شد` : 'به سبد اضافه شد');
      document.querySelectorAll<HTMLElement>('[data-cart-icon]').forEach((icon) => {
        icon.classList.remove('is-pulsing');
        void icon.offsetWidth;
        icon.classList.add('is-pulsing');
      });
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setMessage(''), 2200);
    };
    window.addEventListener(EVENT, onAdd);
    return () => {
      window.removeEventListener(EVENT, onAdd);
      window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <div className="tn-toast-region" aria-live="polite" aria-atomic="true">
      {message ? <p className="tn-toast">{message}</p> : null}
    </div>
  );
}
