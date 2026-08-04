import { NextResponse } from 'next/server';

/** Friendly HTML body for HTTP 410 Gone blog pages. */
export function blogGoneResponse(opts?: { homeHref?: string; blogHref?: string }) {
  const home = opts?.homeHref || '/';
  const blog = opts?.blogHref || '/blog';
  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="robots" content="noindex,nofollow"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>مطلب حذف شده — ۴۱۰</title>
  <style>
    body{font-family:Tahoma,Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}
    .box{max-width:28rem;padding:2rem;text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:1rem}
    a{display:inline-block;margin:.35rem;padding:.55rem 1rem;border-radius:.75rem;background:#0f766e;color:#fff;text-decoration:none;font-size:.875rem}
  </style>
</head>
<body>
  <div class="box">
    <h1 style="font-size:1.35rem;margin:0 0 .75rem">مطلب حذف شده است</h1>
    <p style="color:#64748b;font-size:.875rem;line-height:1.7;margin:0 0 1.25rem">این صفحه دیگر در دسترس نیست (کد وضعیت ۴۱۰).</p>
    <a href="${blog}">بازگشت به وبلاگ</a>
    <a href="${home}" style="background:#334155">خانه</a>
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status: 410,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
