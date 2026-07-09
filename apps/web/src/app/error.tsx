'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">خطایی رخ داده است</h1>
        <p className="text-gray-500 mb-8">متأسفیم، مشکل فنی رخ داده. لطفاً دوباره تلاش کنید.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={reset}
            className="inline-flex items-center justify-center h-11 px-8 rounded-xl bg-primary text-white font-bold hover:bg-primary-dark transition-colors">
            تلاش مجدد
          </button>
          <a href="/"
            className="inline-flex items-center justify-center h-11 px-8 rounded-xl border border-gray-200 text-gray-700 font-medium hover:border-primary hover:text-primary transition-colors">
            بازگشت به خانه
          </a>
        </div>
      </div>
    </div>
  );
}
