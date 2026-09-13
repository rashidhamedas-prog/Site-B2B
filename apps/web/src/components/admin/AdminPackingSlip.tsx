'use client';

import { useCallback, useState } from 'react';
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

let cachedSender: SlipSenderInput | null = null;

async function loadSender(): Promise<SlipSenderInput> {
  if (cachedSender) return cachedSender;
  const settings = await apiClient.get<{ business?: SlipSenderInput }>('/settings/public');
  cachedSender = settings.business ?? {};
  return cachedSender;
}

function PostalRow({ code, label }: { code: string; label: string }) {
  return (
    <div className="ps-postal">
      <span className="ps-postal-label">{label}</span>
      <div className="ps-postal-boxes" dir="ltr" aria-label={`${label} ${code || 'نامشخص'}`}>
        {postalBoxes(code).map((d, i) => (
          <span key={`${label}-${i}`} className="ps-postal-box">
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
      <header className="ps-head">
        <div>
          <p className="ps-kicker">برچسب ارسال + فاکتور بسته‌بندی</p>
          <h1 className="ps-brand">{model.sender.name}</h1>
          <p className="ps-meta">
            {model.channelLabel} · {model.shippingLabel} · {model.paymentLabel}
          </p>
        </div>
        <div className="ps-head-id">
          <p className="ps-order" dir="ltr">
            {model.orderNumber}
          </p>
          <p className="ps-date">{model.createdAt}</p>
          {model.trackingCode ? (
            <p className="ps-track" dir="ltr">
              رهگیری: {model.trackingCode}
            </p>
          ) : (
            <p className="ps-track muted">کد رهگیری هنوز ثبت نشده</p>
          )}
        </div>
      </header>

      <section className="ps-parties">
        <div className="ps-party sender">
          <h2>فرستنده</h2>
          <p className="ps-name">{model.sender.name}</p>
          {model.sender.phone ? (
            <p className="ps-phone" dir="ltr">
              {model.sender.phone}
            </p>
          ) : null}
          <p className="ps-addr">{model.sender.address || 'آدرس دفتر را در تنظیمات کسب‌وکار کامل کنید.'}</p>
          <PostalRow code={model.sender.postalCode} label="کدپستی فرستنده" />
        </div>
        <div className="ps-party recipient">
          <h2>گیرنده — روی بسته بچسبانید</h2>
          <p className="ps-name big">{model.recipient.name}</p>
          {model.recipient.phone ? (
            <p className="ps-phone big" dir="ltr">
              {model.recipient.phone}
            </p>
          ) : null}
          <p className="ps-addr big">{model.recipient.address || 'آدرس گیرنده در سفارش ثبت نشده است.'}</p>
          <PostalRow code={model.recipient.postalCode} label="کدپستی گیرنده" />
        </div>
      </section>

      <section className="ps-pack">
        <div className="ps-pack-title">
          <h2>چک‌لیست آماده‌سازی</h2>
          <p>{model.itemCount.toLocaleString('fa-IR')} عدد</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>کالا</th>
              <th>رنگ / سایز</th>
              <th>تعداد</th>
              <th>مبلغ</th>
              <th className="ps-check">✓</th>
            </tr>
          </thead>
          <tbody>
            {model.lines.map((line, i) => (
              <tr key={`${line.sku}-${line.variant}-${i}`}>
                <td>
                  <strong>{line.name}</strong>
                  <span className="ps-sku" dir="ltr">
                    {line.sku}
                  </span>
                </td>
                <td>{line.variant}</td>
                <td>{line.quantity.toLocaleString('fa-IR')}</td>
                <td>{line.lineToman.toLocaleString('fa-IR')}</td>
                <td className="ps-check">☐</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="ps-foot">
        <div className="ps-invoice">
          <h2>خلاصه فاکتور</h2>
          <dl>
            <div>
              <dt>جمع اقلام</dt>
              <dd>{model.subtotalToman.toLocaleString('fa-IR')} ت</dd>
            </div>
            {model.discountToman > 0 ? (
              <div>
                <dt>تخفیف</dt>
                <dd>−{model.discountToman.toLocaleString('fa-IR')} ت</dd>
              </div>
            ) : null}
            <div>
              <dt>ارسال</dt>
              <dd>{model.shippingToman === 0 ? 'رایگان' : `${model.shippingToman.toLocaleString('fa-IR')} ت`}</dd>
            </div>
            <div className="total">
              <dt>قابل پرداخت</dt>
              <dd>{model.totalToman.toLocaleString('fa-IR')} تومان</dd>
            </div>
          </dl>
        </div>
        <div className="ps-notes">
          <h2>یادداشت ارسال</h2>
          <p>{model.notes || 'شکستنی نیست. قبل از پلمپ، تعداد و سایز را با جدول بالا مطابقت دهید.'}</p>
          <p className="ps-return">مرجوعی و پیگیری فقط با همین شماره سفارش از وب‌سایت یا تماس فرستنده.</p>
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

  const close = useCallback(() => setOpen(false), []);

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
    document.documentElement.classList.add('packing-slip-print');
    const done = () => document.documentElement.classList.remove('packing-slip-print');
    window.addEventListener('afterprint', done, { once: true });
    window.print();
    window.setTimeout(done, 1500);
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
