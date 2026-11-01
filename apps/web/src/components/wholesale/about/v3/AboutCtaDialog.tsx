'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

const SEEN_KEY = 'taranom_about_cta_dialog_shown';

function alreadyShown(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markShown() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* private mode */
  }
}

/** Opens once per session when `section#cta` is half visible. No timer, scroll offset or exit intent. */
export function AboutCtaDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const cta = document.querySelector('section#cta');
    if (!dialog || !cta || alreadyShown() || typeof dialog.showModal !== 'function') return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || alreadyShown()) return;
        io.disconnect();
        markShown();
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.showModal();
      },
      { threshold: 0.5 },
    );
    io.observe(cta);

    const onClose = () => {
      const target = returnFocusRef.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
    };
    dialog.addEventListener('close', onClose);
    return () => {
      io.disconnect();
      dialog.removeEventListener('close', onClose);
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      id="about-cta-dialog"
      className="av3-dialog"
      aria-labelledby="about-cta-dialog-title"
    >
      <p id="about-cta-dialog-title" className="av3-dialog-title">
        همکاری عمده با ترنم را شروع کنید
      </p>
      <p className="av3-body">
        ثبت‌نام عمده چند دقیقه طول می‌کشد؛ پس از تأیید تیم فروش، قیمت‌های عمده برایتان باز می‌شود.
      </p>
      <div className="av3-row">
        <Link className="av3-btn" href="/portal/register">
          ثبت‌نام عمده
        </Link>
        <button type="button" className="av3-dialog-close" onClick={() => dialogRef.current?.close()}>
          بستن
        </button>
      </div>
    </dialog>
  );
}
