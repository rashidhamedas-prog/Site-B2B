'use client';

import { Bell } from 'lucide-react';

export default function NotificationsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">اعلان‌ها</h1>
        <p className="text-sm text-gray-500 mt-1">وضعیت سفارش و تأیید حساب از پیامک اعلام می‌شود.</p>
      </div>
      <div className="card p-12 text-center">
        <Bell className="h-12 w-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">اعلان داخل‌پنلی هنوز فعال نیست</p>
        <p className="text-sm text-gray-400 mt-2">
          پیامک‌های ترنم منبع اعلان هستند. لیست جعلی سفارش یا فاکتور اینجا نشان داده نمی‌شود.
        </p>
      </div>
    </div>
  );
}
