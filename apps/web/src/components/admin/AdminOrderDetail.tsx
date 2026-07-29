'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Truck, CheckCircle, XCircle, Clock, Package, MapPin, Save, Loader2, Trash2, Pencil } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { OrderStatusBadge } from '@/components/ui';
import { cn } from '@/lib/cn';

interface OrderItem {
  id: string;
  productName: string;
  sku: string;
  color: string;
  size: string;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  type: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  paymentMethod: string;
  shippingMethod: string;
  shippingAddress?: string;
  trackingCode?: string;
  freightCost?: number;
  freightReceiptUrl?: string;
  notes?: string;
  voidedAt?: string;
  voidReason?: string;
  createdAt: string;
  items: OrderItem[];
  customer?: { id: string; businessName: string; ownerName: string; phone: string; city: string; province: string };
}

function toman(n: number) { return Math.round(Number(n) / 10).toLocaleString('fa-IR'); }

const SHIP_METHODS = [
  { id: 'CHAPAR', label: 'چاپار' },
  { id: 'TIPAX', label: 'تیپاکس' },
  { id: 'SNAPP', label: 'اسنپ‌باکس (درون‌شهری مشهد)' },
  { id: 'POST', label: 'پست پیشتاز' },
  { id: 'FREIGHT', label: 'باربری (سفارش حجمی)' },
  { id: 'PISHTAZ', label: 'پست پیشتاز (تکی)' },
  { id: 'TEHRAN_BIKE', label: 'پیک تهران' },
];

function trackingLink(method: string, code: string): string {
  const urls: Record<string, string> = {
    CHAPAR: `https://chaparapp.ir/tracking/${code}`,
    POST: `https://tracking.post.ir/?id=${code}`,
    TIPAX: `https://tipaxco.com/tracking?code=${code}`,
    SNAPP: `https://box.snapp.ir/tracking/${code}`,
  };
  return urls[method] ?? urls.CHAPAR;
}

const STATUS_FLOW = [
  { key: 'PENDING_REVIEW', label: 'در انتظار بررسی', icon: Clock },
  { key: 'PROCESSING', label: 'در حال پردازش', icon: Package },
  { key: 'CONFIRMED', label: 'تأیید شده', icon: CheckCircle },
  { key: 'SHIPPED', label: 'ارسال شده', icon: Truck },
  { key: 'DELIVERED', label: 'تحویل داده شده', icon: CheckCircle },
  { key: 'COMPLETED', label: 'تکمیل شده', icon: CheckCircle },
];

function AdminOrderDetailInner({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { upload: uploadImage, uploading: uploadingReceipt } = useImageUpload();
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackingCode, setTrackingCode] = useState('');
  const [shipMethod, setShipMethod] = useState('CHAPAR');
  const [freightCostToman, setFreightCostToman] = useState('');
  const [freightReceiptUrl, setFreightReceiptUrl] = useState('');
  const [savingTracking, setSavingTracking] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editShipMethod, setEditShipMethod] = useState('');
  const [editPayMethod, setEditPayMethod] = useState('');
  const [editQtys, setEditQtys] = useState<Record<string, number>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [voiding, setVoiding] = useState(false);

  useEffect(() => {
    if (searchParams.get('edit') === '1') setEditing(true);
  }, [searchParams]);

  useEffect(() => {
    apiClient.get<Order>(`/orders/${id}`)
      .then((data) => {
        setOrder(data);
        setTrackingCode(data.trackingCode ?? '');
        setShipMethod(data.shippingMethod ?? 'CHAPAR');
        setFreightCostToman(
          data.freightCost != null && Number(data.freightCost) > 0
            ? String(Math.round(Number(data.freightCost) / 10))
            : '',
        );
        setFreightReceiptUrl(data.freightReceiptUrl ?? '');
        setEditNotes(data.notes ?? '');
        setEditAddress(data.shippingAddress ?? '');
        setEditShipMethod(data.shippingMethod ?? '');
        setEditPayMethod(data.paymentMethod ?? '');
        const q: Record<string, number> = {};
        for (const it of data.items ?? []) q[it.id] = Number(it.quantity) || 0;
        setEditQtys(q);
      })
      .catch(() => router.push('/admin/orders'))
      .finally(() => setLoading(false));
  }, [id, router]);

  const updateStatus = async (status: string) => {
    if (!order) return;
    setUpdatingStatus(true);
    try {
      const updated = await apiClient.patch<Order>(`/orders/${order.id}/status`, { status });
      setOrder(updated);
    } catch (e: any) {
      alert(e?.message || 'خطا');
    } finally { setUpdatingStatus(false); }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      setFreightReceiptUrl(url);
    } catch {
      alert('آپلود رسید با خطا مواجه شد');
    } finally {
      if (receiptInputRef.current) receiptInputRef.current.value = '';
    }
  };

  const saveTracking = async () => {
    if (!order || !trackingCode) return;
    setSavingTracking(true);
    try {
      const freightCost = freightCostToman ? Math.round(Number(freightCostToman) || 0) * 10 : 0;
      const updated = await apiClient.patch<Order>(`/orders/${order.id}/tracking`, {
        trackingCode,
        shippingMethod: shipMethod,
        freightCost,
        freightReceiptUrl: freightReceiptUrl || undefined,
      });
      setOrder(updated);
    } catch {} finally { setSavingTracking(false); }
  };

  const saveEdit = async () => {
    if (!order) return;
    setSavingEdit(true);
    try {
      const updated = await apiClient.patch<Order>(`/orders/${order.id}`, {
        notes: editNotes,
        shippingAddress: editAddress,
        shippingMethod: editShipMethod || undefined,
        paymentMethod: editPayMethod || undefined,
        items: Object.entries(editQtys).map(([itemId, quantity]) => ({ id: itemId, quantity })),
      });
      setOrder(updated);
      setEditing(false);
    } catch (e: any) {
      alert(e?.message || 'خطا در ذخیره ویرایش');
    } finally {
      setSavingEdit(false);
    }
  };

  const voidOrder = async () => {
    if (!order) return;
    if (!confirm('سفارش حذف شود؟ موجودی و کیف‌پول معکوس می‌شود؛ ردیف برای مشاهده جزئیات می‌ماند.')) return;
    setVoiding(true);
    try {
      const updated = await apiClient.delete<Order>(`/orders/${order.id}`, { reason: 'حذف از جزئیات ادمین' });
      setOrder(updated);
      setEditing(false);
    } catch (e: any) {
      alert(e?.message || 'خطا در حذف');
    } finally {
      setVoiding(false);
    }
  };

  if (loading) return <div className="p-8"><div className="skeleton h-64 rounded-2xl" /></div>;
  if (!order) return null;

  const deleted = order.status === 'DELETED' || !!order.voidedAt;
  const canEditItems = !deleted && !['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status);
  const currentStepIdx = deleted ? -1 : STATUS_FLOW.findIndex((s) => s.key === order.status);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/admin/orders" className="text-gray-400 hover:text-primary"><ArrowRight className="h-5 w-5" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">{order.orderNumber}</h2>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString('fa-IR', { dateStyle: 'long' })}</p>
        </div>
        {!deleted && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEditing((v) => !v)} className="btn btn-outline btn-sm inline-flex items-center gap-1.5">
              <Pencil className="h-3.5 w-3.5" />{editing ? 'بستن ویرایش' : 'ویرایش'}
            </button>
            <button type="button" onClick={voidOrder} disabled={voiding} className="btn btn-sm border border-error text-error hover:bg-red-50 inline-flex items-center gap-1.5">
              {voiding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}حذف
            </button>
          </div>
        )}
      </div>

      {deleted && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          این سفارش حذف شده است — از فرایند سایت خارج است، ولی جزئیات برای آرشیو قابل مشاهده است.
          {order.voidReason ? <span className="block mt-1 text-xs opacity-80">دلیل: {order.voidReason}</span> : null}
        </div>
      )}

      {!deleted && (
        <div className="card p-5">
          <div className="flex items-center gap-0">
            {STATUS_FLOW.map((s, i) => {
              const done = i < currentStepIdx;
              const active = i === currentStepIdx;
              return (
                <div key={s.key} className="flex items-center flex-1">
                  <div className={cn('flex flex-col items-center', i < STATUS_FLOW.length - 1 ? 'flex-1' : '')}>
                    <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2',
                      done ? 'bg-success border-success text-white' : active ? 'bg-primary border-primary text-white' : 'bg-white border-gray-200 text-gray-400')}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    <p className={cn('text-[10px] mt-1 text-center hidden sm:block', active ? 'text-primary font-bold' : done ? 'text-success' : 'text-gray-400')}>{s.label}</p>
                  </div>
                  {i < STATUS_FLOW.length - 1 && <div className={cn('h-0.5 flex-1 mx-1', done ? 'bg-success' : 'bg-gray-100')} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editing && !deleted && (
        <div className="card p-5 space-y-4 border border-primary/20">
          <h3 className="font-bold text-gray-900 text-sm">ویرایش سفارش</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-gray-600">روش ارسال</span>
              <select className="w-full rounded-lg border px-3 py-2 text-sm" value={editShipMethod} onChange={(e) => setEditShipMethod(e.target.value)}>
                {SHIP_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-gray-600">روش پرداخت</span>
              <input className="w-full rounded-lg border px-3 py-2 text-sm" value={editPayMethod} onChange={(e) => setEditPayMethod(e.target.value)} />
            </label>
          </div>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-600">آدرس ارسال</span>
            <textarea className="w-full rounded-lg border px-3 py-2 text-sm min-h-[72px]" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-600">یادداشت</span>
            <textarea className="w-full rounded-lg border px-3 py-2 text-sm min-h-[64px]" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
          </label>
          {canEditItems && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">تعداد اقلام (موجودی همگام می‌شود)</p>
              {(order.items ?? []).map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{it.productName} — {it.color}/{it.size}</span>
                  <input type="number" min={0} className="w-24 rounded-lg border px-2 py-1.5 text-sm" value={editQtys[it.id] ?? it.quantity}
                    onChange={(e) => setEditQtys((q) => ({ ...q, [it.id]: Number(e.target.value) || 0 }))} />
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={saveEdit} disabled={savingEdit} className="btn btn-primary btn-md inline-flex items-center gap-2">
            {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}ذخیره تغییرات
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-bold text-gray-900">اقلام سفارش</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-50">
                <tr>{['محصول', 'رنگ/سایز', 'تعداد', 'قیمت واحد', 'جمع'].map((h) => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {order.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt={item.color || item.productName}
                            className="h-12 w-10 rounded-lg object-cover border border-gray-100"
                          />
                        ) : (
                          <span className="h-12 w-10 rounded-lg bg-gray-100" />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.productName}</p>
                          <p className="text-xs text-gray-400 font-mono">{item.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.color} / {item.size}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{toman(item.unitPrice)} ت</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap">{toman(item.totalPrice)} ت</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 border-t border-gray-100 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-500">جمع اقلام</span><span>{toman(order.subtotal)} ت</span></div>
            {Number(order.discount) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">تخفیف</span><span>-{toman(order.discount)}</span></div>}
            <div className="flex justify-between text-sm"><span className="text-gray-500">هزینه ارسال</span><span>{Number(order.shippingFee) === 0 ? 'رایگان' : `${toman(order.shippingFee)} ت`}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-2"><span>مجموع کل</span><span className="text-primary">{toman(order.total)} تومان</span></div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />اطلاعات مشتری</h3>
            {order.customer ? (
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-gray-900">{order.customer.businessName}</p>
                <p className="text-gray-500">{order.customer.ownerName}</p>
                <p className="text-gray-500">{order.customer.phone}</p>
                <p className="text-gray-500">{order.customer.city}، {order.customer.province}</p>
              </div>
            ) : <p className="text-sm text-gray-400">اطلاعات مشتری موجود نیست</p>}
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2"><Truck className="h-4 w-4 text-primary" />ارسال</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">روش ارسال</span><span>{SHIP_METHODS.find((m) => m.id === order.shippingMethod)?.label ?? order.shippingMethod}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">روش پرداخت</span><span>{order.paymentMethod}</span></div>
              {order.trackingCode && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">کد پیگیری</span>
                  <a href={trackingLink(order.shippingMethod, order.trackingCode)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-primary hover:underline">{order.trackingCode}</a>
                </div>
              )}
            </div>
            {!deleted && ['CONFIRMED', 'PROCESSING'].includes(order.status) && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                <select value={shipMethod} onChange={(e) => setShipMethod(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-xs">
                  {SHIP_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <input value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} placeholder="کد پیگیری" className="w-full rounded-lg border px-3 py-2 text-xs" />
                <input type="number" value={freightCostToman} onChange={(e) => setFreightCostToman(e.target.value)} placeholder="هزینه باربری (تومان)" className="w-full rounded-lg border px-3 py-2 text-xs" />
                <input ref={receiptInputRef} type="file" accept="image/*" onChange={handleReceiptUpload} className="w-full text-xs" />
                <button onClick={saveTracking} disabled={savingTracking || !trackingCode || uploadingReceipt} className="w-full btn btn-primary btn-sm inline-flex items-center justify-center gap-1.5">
                  {savingTracking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}ذخیره اطلاعات ارسال
                </button>
              </div>
            )}
          </div>

          {!deleted && order.status === 'PENDING_REVIEW' && (
            <div className="card p-5 space-y-2">
              <button onClick={() => updateStatus('PROCESSING')} disabled={updatingStatus} className="w-full btn btn-primary btn-md flex items-center justify-center gap-2"><CheckCircle className="h-4 w-4" />تأیید و پردازش</button>
              <button onClick={() => updateStatus('CANCELLED')} disabled={updatingStatus} className="w-full btn btn-md border border-error text-error hover:bg-red-50 flex items-center justify-center gap-2"><XCircle className="h-4 w-4" />رد سفارش</button>
            </div>
          )}
          {!deleted && order.status === 'PROCESSING' && (
            <button onClick={() => updateStatus('CONFIRMED')} disabled={updatingStatus} className="w-full btn btn-primary btn-md flex items-center justify-center gap-2 card p-5"><CheckCircle className="h-4 w-4" />تأیید نهایی</button>
          )}
          {!deleted && order.status === 'SHIPPED' && (
            <button onClick={() => updateStatus('DELIVERED')} disabled={updatingStatus} className="w-full btn btn-primary btn-md flex items-center justify-center gap-2 card p-5"><Truck className="h-4 w-4" />تحویل داده شد</button>
          )}
          {order.notes && (
            <div className="card p-4 bg-amber-50 border-amber-200">
              <p className="text-xs font-medium text-amber-700 mb-1">یادداشت</p>
              <p className="text-sm text-amber-800 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminOrderDetail({ id }: { id: string }) {
  return (
    <Suspense fallback={<div className="p-8"><div className="skeleton h-64 rounded-2xl" /></div>}>
      <AdminOrderDetailInner id={id} />
    </Suspense>
  );
}
