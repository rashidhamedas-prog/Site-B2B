'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { Modal } from '@/components/ui';
import { apiClient } from '@/lib/api';
import {
  buildPackingSlip,
  canShowPackingSlip,
  postalBoxes,
  type PackingSlipModel,
  type SlipOrderInput,
  type SlipSenderInput,
} from '@/lib/packing-slip';
import './packing-slip.css';

type DetailOrder = SlipOrderInput & { id: string; status: string };

const LOGO_SRC = '/logo-512.png';

async function loadSender(): Promise<SlipSenderInput> {
  const settings = await apiClient.get<{ business?: SlipSenderInput }>('/settings/public');
  return settings.business ?? {};
}

function PostalRow({ code, label, large = false }: { code: string; label: string; large?: boolean }) {
  return (
    <div className={`ps-postal${large ? ' large' : ''}`}>
      <span className="ps-postal-label">{label}</span>
      <div className="ps-postal-boxes" dir="ltr" aria-label={`${label} ${code || 'نامشخص'}`}>
        {postalBoxes(code).map((d, i) => (
          <span key={`${label}-${i}`} className={`ps-postal-box${i === 4 ? ' gap' : ''}`}>
            {d.trim() ? d : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function SlipSheet({ model }: { model: PackingSlipModel }) {
  return (
    <article className="ps-sheet" dir="rtl" lang="fa">
      <header className="ps-mast">
        <div className="ps-brand-lockup">
          <img src={LOGO_SRC} alt="لوگوی پوشاک ترنم" width={64} height={64} className="ps-logo" />
          <div>
            <p className="ps-kicker">برگه بسته</p>
            <h1 className="ps-brand">{model.sender.name}</h1>
            <p className="ps-meta">
              {model.channelLabel}
              <span aria-hidden="true"> · </span>
              {model.shippingLabel}
              <span aria-hidden="true"> · </span>
              {model.paymentLabel}
            </p>
          </div>
        </div>
        <div className="ps-order-stamp">
          <p className="ps-order-label">شماره سفارش</p>
          <p className="ps-order" dir="ltr">
            {model.orderNumber}
          </p>
          <p className="ps-date">{model.createdAt}</p>
          {model.trackingCode ? (
            <p className="ps-track" dir="ltr">
              رهگیری {model.trackingCode}
            </p>
          ) : (
            <p className="ps-track muted">رهگیری هنوز ثبت نشده</p>
          )}
        </div>
      </header>

      <section className="ps-from" aria-label="فرستنده">
        <div className="ps-from-copy">
          <h2>فرستنده</h2>
          <p className="ps-from-name">{model.sender.name}</p>
          {model.sender.phone ? (
            <p className="ps-from-phone" dir="ltr">
              {model.sender.phone}
            </p>
          ) : null}
          <p className="ps-from-addr">{model.sender.address || 'آدرس دفتر را در تنظیمات کسب‌وکار کامل کنید.'}</p>
        </div>
        <PostalRow code={model.sender.postalCode} label="کدپستی فرستنده" />
      </section>

      <section className="ps-to" aria-label="گیرنده">
        <div className="ps-to-bar">
          <h2>گیرنده</h2>
          <p>این بخش را روی بسته بچسبانید</p>
        </div>
        <div className="ps-to-body">
          <p className="ps-to-name">{model.recipient.name}</p>
          {model.recipient.phone ? (
            <p className="ps-to-phone" dir="ltr">
              {model.recipient.phone}
            </p>
          ) : null}
          <p className="ps-to-addr">{model.recipient.address || 'آدرس گیرنده در سفارش ثبت نشده است.'}</p>
          <PostalRow code={model.recipient.postalCode} label="کدپستی گیرنده" large />
        </div>
      </section>

      <section className="ps-pack">
        <div className="ps-pack-title">
          <h2>تطبیق کالا</h2>
          <p>
            <span className="ps-count">{model.itemCount.toLocaleString('fa-IR')}</span>
            <span> عدد</span>
          </p>
        </div>
        <table>
          <thead>
            <tr>
              <th className="ps-check">تطبیق</th>
              <th>کالا</th>
              <th>رنگ / سایز</th>
              <th>تعداد</th>
              <th>مبلغ</th>
            </tr>
          </thead>
          <tbody>
            {model.lines.map((line, i) => (
              <tr key={`${line.sku}-${line.variant}-${i}`}>
                <td className="ps-check">
                  <span className="ps-tick" aria-hidden="true" />
                </td>
                <td>
                  <strong>{line.name}</strong>
                  <span className="ps-sku" dir="ltr">
                    {line.sku}
                  </span>
                </td>
                <td>{line.variant}</td>
                <td className="ps-num">{line.quantity.toLocaleString('fa-IR')}</td>
                <td className="ps-num">{line.lineToman.toLocaleString('fa-IR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="ps-foot">
        <div className="ps-invoice">
          <h2>مبالغ سفارش</h2>
          <dl>
            <div>
              <dt>جمع اقلام</dt>
              <dd>{model.subtotalToman.toLocaleString('fa-IR')} تومان</dd>
            </div>
            {model.discountToman > 0 ? (
              <div>
                <dt>تخفیف</dt>
                <dd>−{model.discountToman.toLocaleString('fa-IR')} تومان</dd>
              </div>
            ) : null}
            <div>
              <dt>ارسال</dt>
              <dd>{model.shippingToman === 0 ? 'رایگان' : `${model.shippingToman.toLocaleString('fa-IR')} تومان`}</dd>
            </div>
            <div className="total">
              <dt>قابل پرداخت</dt>
              <dd>{model.totalToman.toLocaleString('fa-IR')} تومان</dd>
            </div>
          </dl>
        </div>
        <div className="ps-notes">
          <h2>یادداشت بسته‌بندی</h2>
          <p>{model.notes || 'تعداد، رنگ و سایز هر ردیف را با کالا یکی کنید، بعد بسته را پلمپ کنید.'}</p>
          <p className="ps-return">پیگیری و مرجوعی فقط با همین شماره سفارش.</p>
          <div className="ps-sign">
            <span className="ps-tick" aria-hidden="true" />
            <span>تطبیق و بررسی شد</span>
          </div>
        </div>
      </footer>
    </article>
  );
}

export function AdminPackingSlipButton({
  orderId,
  status,
  compact = false,
}: {
  orderId: string;
  status?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [model, setModel] = useState<PackingSlipModel | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('packing-slip-print');
    }
  }, []);

  useEffect(() => {
    if (!open && typeof document !== 'undefined') {
      document.documentElement.classList.remove('packing-slip-print');
    }
  }, [open]);

  const load = async () => {
    setOpen(true);
    setLoading(true);
    setError('');
    try {
      const [order, sender] = await Promise.all([
        apiClient.get<DetailOrder>(`/orders/${orderId}`),
        loadSender(),
      ]);
      setModel(buildPackingSlip(order, sender));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خواندن سفارش ناموفق بود');
    } finally {
      setLoading(false);
    }
  };

  const printSheet = () => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.add('packing-slip-print');
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.documentElement.classList.remove('packing-slip-print');
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    // Safety fallback for browsers without reliable afterprint
    window.setTimeout(cleanup, 120000);
    window.print();
  };

  if (!canShowPackingSlip(status)) return null;

  const incomplete = Boolean(
    model && (!model.recipient.address || !model.recipient.postalCode || !model.recipient.phone),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => void load()}
        className={
          compact
            ? 'text-gray-400 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
            : 'inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
        }
        aria-label="پیش‌نمایش برگه بسته‌بندی و چاپ A5"
        title="برگه بسته‌بندی A5"
      >
        <Printer className="h-4 w-4" />
        {compact ? null : <span>برگه بسته</span>}
      </button>

      <Modal open={open} onClose={close} title="پیش‌نمایش برگه A5" size="xl" className="max-w-[860px] no-print">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-6 py-3">
          <p className="ps-modal-note min-w-0">اول بررسی کنید، بعد روی برگه A5 چاپ و روی بسته بچسبانید.</p>
          <button
            type="button"
            onClick={printSheet}
            disabled={!model}
            className="btn btn-primary btn-sm inline-flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Printer className="h-4 w-4" />
            چاپ A5
          </button>
        </div>
        {incomplete ? (
          <p className="ps-warn">نام، تلفن، آدرس یا کدپستی گیرنده ناقص است — قبل از ارسال تکمیل کنید.</p>
        ) : null}
        <div className="ps-preview-frame">
          {loading ? <p className="p-8 text-sm text-gray-500">در حال ساخت برگه…</p> : null}
          {error ? <p className="p-8 text-sm text-red-600">{error}</p> : null}
          {model ? <SlipSheet model={model} /> : null}
        </div>
      </Modal>

      {open && model && typeof document !== 'undefined'
        ? createPortal(
            <div className="ps-print-root">
              <SlipSheet model={model} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
