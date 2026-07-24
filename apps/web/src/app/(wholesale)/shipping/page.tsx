import type { Metadata } from 'next';
import { Truck, Package, Clock, MapPin } from 'lucide-react';

export const metadata: Metadata = {
  title: 'شرایط ارسال عمده',
  description:
    'نحوه بسته‌بندی، زمان آماده‌سازی و گزینه‌های ارسال سفارش عمده ترنم به شهرهای مختلف ایران.',
  alternates: { canonical: 'https://poshaktaranom.com/shipping' },
};

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <section className="page-hero">
        <div className="container-site relative z-10 text-center">
          <h1 className="mb-3 text-4xl font-extrabold tracking-tight">شرایط ارسال</h1>
          <p className="text-white/70">نحوه ارسال سفارشات عمده به سراسر ایران</p>
        </div>
      </section>
      <div className="container-site py-12 max-w-3xl">
        <div className="grid gap-6 sm:grid-cols-2 mb-8">
          {[
            { icon: Clock, title: 'زمان آماده‌سازی', desc: '۱ تا ۳ روز کاری پس از تأیید سفارش' },
            { icon: Truck, title: 'روش‌های ارسال', desc: 'چاپار، تیپاکس، پست، تحویل حضوری (مشهد)' },
            { icon: MapPin, title: 'پوشش ارسال', desc: 'سراسر ایران — شهرهای بزرگ اولویت دارند' },
            { icon: Package, title: 'بسته‌بندی', desc: 'کیف‌های پلی‌اتیلن + کارتن محکم' },
          ].map((item) => (
            <div key={item.title} className="card p-5 flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm mb-1">{item.title}</h3>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="card p-8 space-y-6">
          <h2 className="font-bold text-gray-900">هزینه ارسال</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-right py-2 font-semibold text-gray-600">سطح مشتری</th>
                <th className="text-right py-2 font-semibold text-gray-600">ارسال مشهد</th>
                <th className="text-right py-2 font-semibold text-gray-600">ارسال سراسر ایران</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { level: 'سطح A', mashhad: 'رایگان', nationwide: 'رایگان' },
                { level: 'سطح B', mashhad: 'رایگان', nationwide: 'نیمه‌رایگان (۵۰٪)' },
                { level: 'سطح C', mashhad: 'بر اساس وزن', nationwide: 'بر اساس وزن' },
              ].map((r) => (
                <tr key={r.level}>
                  <td className="py-3 text-gray-700">{r.level}</td>
                  <td className="py-3 text-gray-700">{r.mashhad}</td>
                  <td className="py-3 text-gray-700">{r.nationwide}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400">
            * سفارش بالای ۵ میلیون تومان برای همه سطوح ارسال رایگان است.
          </p>
        </div>
      </div>
    </div>
  );
}
