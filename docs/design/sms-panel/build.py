# generates screens/*.html (each self-contained: inline CSS, fonts via ../fonts local path w/ system fallback)
import pathlib
OUT=pathlib.Path(__file__).parent/"screens"
CSS="""
@font-face{font-family:Vazirmatn;src:url(../fonts/Vazirmatn-Regular.ttf);font-weight:400}
@font-face{font-family:Vazirmatn;src:url(../fonts/Vazirmatn-Bold.ttf);font-weight:700}
:root{--bg:#f6f7f9;--surface:#fff;--text:#1a1f2b;--muted:#4b5565;--border:#d5d9e0;--primary:#1d4ed8;--primary-ink:#fff;
--otp:#1d4ed8;--otp-bg:#e8efff;--trx:#15803d;--trx-bg:#e7f6ec;--promo:#b45309;--promo-bg:#fff1e0;
--danger:#b91c1c;--danger-bg:#fdecec;--warn:#92400e;--warn-bg:#fef6d8;--ok:#166534;--ok-bg:#e6f5ea;--info-bg:#eef2ff;
--focus:#1d4ed8;--r:10px;--sp1:4px;--sp2:8px;--sp3:12px;--sp4:16px;--sp6:24px}
*{box-sizing:border-box}html{scroll-padding-top:72px;font-family:Vazirmatn,Tahoma,"Segoe UI",system-ui,sans-serif;font-size:16px;line-height:1.7;color:var(--text);background:var(--bg)}
body{margin:0}a{color:var(--primary)}:focus-visible{outline:3px solid var(--focus);outline-offset:2px;border-radius:4px}
.skip{position:absolute;inset-inline-start:-999px}.skip:focus{inset-inline-start:8px;top:8px;background:#fff;padding:8px;z-index:9}
.app{display:grid;grid-template-columns:1fr;min-height:100vh}
.side{display:none;background:#111827;color:#e5e7eb;padding:var(--sp4)}
.side a{display:flex;min-height:44px;align-items:center;padding:0 12px;color:#e5e7eb;text-decoration:none;border-radius:8px}
.side a[aria-current]{background:#1f2937;color:#fff;font-weight:700;border-inline-start:4px solid #60a5fa}
.side h2{font-size:14px;color:#cbd5e1;margin:0 0 8px}
.top{position:sticky;top:0;z-index:5;background:var(--surface);border-bottom:1px solid var(--border);padding:var(--sp2) var(--sp4);display:flex;flex-wrap:wrap;gap:var(--sp2);align-items:center;justify-content:space-between}
.top .menu{min-width:44px;min-height:44px}
.credit{display:flex;gap:8px;align-items:center;padding:6px 12px;border-radius:999px;border:1px solid var(--border);font-size:14px}
.credit.warn{background:var(--warn-bg);color:var(--warn);border-color:#e9c46a}.credit.low{background:var(--danger-bg);color:var(--danger);border-color:#f0a3a3}
.conn{font-size:13px;color:var(--muted)}
main{padding:var(--sp4);max-width:1240px;width:100%}
h1{font-size:22px;margin:4px 0 12px}h2{font-size:18px;margin:0 0 8px}h3{font-size:16px;margin:0 0 6px}
.grid{display:grid;gap:var(--sp3);grid-template-columns:1fr}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:var(--sp4)}
.kpi b{display:block;font-size:24px}.kpi span{color:var(--muted);font-size:14px}
.btn{font:inherit;min-height:44px;padding:0 16px;border-radius:8px;border:1px solid var(--border);background:#fff;color:var(--text);cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.btn.primary{background:var(--primary);color:#fff;border-color:var(--primary)}
.btn.danger{background:var(--danger);color:#fff;border-color:var(--danger)}
.btn[disabled],.btn[aria-disabled=true]{background:#e5e7eb;color:#4b5565;border-color:#d1d5db;cursor:not-allowed}
.row{display:flex;flex-wrap:wrap;gap:var(--sp2);align-items:center}
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:999px;font-size:13px;font-weight:700;border:1px solid transparent}
.b-otp{background:var(--otp-bg);color:var(--otp)}.b-trx{background:var(--trx-bg);color:var(--trx)}.b-promo{background:var(--promo-bg);color:var(--promo)}
.s-q{background:#eef0f4;color:#374151}.s-sending{background:var(--info-bg);color:#1e40af}.s-sent{background:#e0f2fe;color:#075985}.s-dlv{background:var(--ok-bg);color:var(--ok)}
.s-und{background:var(--warn-bg);color:var(--warn)}.s-fail{background:var(--danger-bg);color:var(--danger)}.s-skip{background:#f3e8ff;color:#6b21a8}.s-unk{background:#fff;color:#92400e;border-color:#92400e;border-style:dashed}.s-cnl{background:#f3f4f6;color:#374151;text-decoration:line-through}
label{display:block;font-weight:700;margin-bottom:4px}
input,select,textarea{font:inherit;width:100%;min-height:44px;padding:8px 12px;border:1px solid #8b93a1;border-radius:8px;background:#fff;color:var(--text)}
textarea{min-height:120px}.ltr{direction:ltr;text-align:left;unicode-bidi:plaintext}
.hint{font-size:13px;color:var(--muted)}.err{color:var(--danger);font-size:14px;font-weight:700}
[aria-invalid=true]{border-color:var(--danger);border-width:2px}
.field{margin-bottom:var(--sp4)}
.alert{border-radius:8px;padding:12px;border-inline-start:5px solid;margin-bottom:12px}
.alert.err{background:var(--danger-bg);border-color:var(--danger);color:#7f1d1d}.alert.warn{background:var(--warn-bg);border-color:#b45309;color:#78350f}
.alert.ok{background:var(--ok-bg);border-color:var(--ok);color:#14532d}.alert.info{background:var(--info-bg);border-color:var(--primary);color:#1e3a8a}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:10px 8px;border-bottom:1px solid var(--border);text-align:start;vertical-align:top}th{color:var(--muted);font-weight:700;background:#fafbfc}
.tablewrap{overflow-x:auto}
.sk{background:linear-gradient(90deg,#eceef2,#f6f7f9,#eceef2);background-size:200% 100%;animation:sh 1.4s infinite;border-radius:6px;height:16px;margin:6px 0}
@keyframes sh{to{background-position:-200% 0}}@media (prefers-reduced-motion:reduce){.sk{animation:none}}
.empty{text-align:center;padding:32px;color:var(--muted)}
.state-label{font-size:12px;font-weight:700;color:#6b21a8;background:#f3e8ff;padding:2px 8px;border-radius:6px;display:inline-block;margin-bottom:6px}
.phone{width:260px;max-width:100%;border:10px solid #111827;border-radius:28px;padding:14px;background:#f1f5f9;min-height:300px}
.bubble{background:#fff;border-radius:14px;padding:10px 12px;white-space:pre-wrap;box-shadow:0 1px 2px #0002}
.lock{display:inline-block;background:#e5e7eb;color:#374151;border-radius:4px;padding:0 6px}
.steps{display:flex;gap:6px;list-style:none;padding:0;margin:0 0 12px;flex-wrap:wrap}.steps li{padding:6px 10px;border-radius:999px;background:#eef0f4;font-size:13px}
.steps li[aria-current]{background:var(--primary);color:#fff;font-weight:700}.steps li.done{background:var(--ok-bg);color:var(--ok)}
.bar{display:flex;height:18px;border-radius:9px;overflow:hidden;background:#eef0f4}.bar span{display:block}
.modal-back{background:#0009;padding:16px;border-radius:var(--r)}
.modal{background:#fff;border-radius:12px;max-width:560px;margin:auto;padding:20px;border-top:6px solid var(--danger)}
.chip{display:inline-block;border:1px dashed var(--primary);color:var(--primary);padding:2px 8px;border-radius:6px;margin:2px;font-family:monospace;direction:ltr}
.drop{border:2px dashed #8b93a1;border-radius:var(--r);padding:24px;text-align:center}
.tabs{display:flex;gap:4px;border-bottom:2px solid var(--border);margin-bottom:12px}.tabs [role=tab]{min-height:44px;padding:0 16px;border:0;background:none;font:inherit;cursor:pointer}.tabs [aria-selected=true]{border-bottom:3px solid var(--primary);font-weight:700;color:var(--primary)}
.drawer{border-inline-start:4px solid var(--primary)}
.tl{list-style:none;padding:0;margin:0}.tl li{border-inline-start:3px solid var(--border);padding:0 12px 10px;position:relative}
@media (min-width:768px){.grid.c2{grid-template-columns:1fr 1fr}.grid.c3{grid-template-columns:repeat(3,1fr)}.grid.c5{grid-template-columns:repeat(3,1fr)}main{padding:var(--sp6)}}
@media (min-width:1024px){.app{grid-template-columns:240px 1fr}.side{display:block}.top .menu{display:none}.grid.c5{grid-template-columns:repeat(5,1fr)}.grid.side-r{grid-template-columns:2fr 1fr}}
"""
NAV=[("dashboard","داشبورد"),("single-send","ارسال تکی"),("campaign-wizard","ارسال انبوه (کمپین‌ها)"),("templates","قالب‌ها"),("contacts","مخاطبان و سگمنت‌ها"),("reports","گزارش‌ها"),("optout","لغو و لیست سیاه"),("audit","گزارش فعالیت"),("settings","تنظیمات")]
ALIAS={"campaign-confirm":"campaign-wizard","campaign-approval":"campaign-wizard","campaign-run":"campaign-wizard","states":None}
def page(slug,title,body,credit="normal"):
    cur=ALIAS.get(slug,slug)
    nav="".join(f'<a href="{s}.html"{" aria-current=\"page\"" if s==cur else ""}>{t}</a>' for s,t in NAV)
    cr={"normal":'<div class="credit" role="status" aria-label="اعتبار باقی‌مانده: ۱۲۸٬۴۰۰ واحد اعتبار">اعتبار: <b>۱۲۸٬۴۰۰</b> واحد اعتبار</div>',
        "warn":'<div class="credit warn" role="status">⚠ اعتبار رو به اتمام: <b>۴٬۲۰۰</b> واحد اعتبار</div>',
        "low":'<div class="credit low" role="alert">⛔ اعتبار ناکافی: <b>۸۰۰</b> واحد اعتبار</div>'}[credit]
    html=f'''<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — پنل پیامک ترنم</title><style>{CSS}</style></head><body><a class="skip" href="#main">رفتن به محتوای اصلی</a>
<div class="app"><nav class="side" aria-label="منوی پیامک"><h2>پیامک</h2>{nav}</nav><div>
<header class="top"><button class="btn menu" aria-label="باز کردن منو" aria-expanded="false">☰</button>
<div class="row">{cr}<span class="conn">sms.ir · مسیر egress · <span aria-label="اتصال برقرار">● متصل</span></span></div></header>
<main id="main" tabindex="-1"><h1>{title}</h1>{body}</main></div></div></body></html>'''
    (OUT/f"{slug}.html").write_text(html,encoding="utf-8")
SL=lambda t:f'<span class="state-label">حالت: {t}</span>'
# 1 dashboard
page("dashboard","داشبورد پیامک",f'''
<section class="grid c5" aria-label="شاخص‌ها">
<div class="card kpi"><span>ارسال امروز</span><b>۳٬۴۱۲</b></div><div class="card kpi"><span>نرخ تحویل ۷ روز</span><b>۹۴٫۲٪</b></div>
<div class="card kpi"><span>در صف</span><b>۲۱۰</b></div><div class="card kpi"><span>ناموفق</span><b>۳۸</b></div><div class="card kpi"><span>لغوهای جدید</span><b>۱۲</b></div></section>
<section class="card" style="margin-top:12px"><h2>ارسال روزانه (۱۴ روز اخیر)</h2>
<svg viewBox="0 0 700 160" role="img" aria-label="نمودار ستونی ارسال روزانه؛ بیشترین ۵٬۲۰۰ در ۱۴۰۵/۰۸/۰۱" width="100%" height="160">
{"".join(f'<rect x="{20+i*48}" y="{150-h}" width="30" height="{h}" fill="#1d4ed8" rx="3"/>' for i,h in enumerate([60,80,40,90,120,70,65,100,130,85,95,140,110,75]))}</svg>
<p class="hint">جدول داده معادل نمودار برای صفحه‌خوان: «نمایش جدول».</p></section>
<section class="card" style="margin-top:12px"><h2>کمپین‌های در حال اجرا / زمان‌بندی‌شده</h2><div class="tablewrap"><table>
<thead><tr><th>نام</th><th>نوع</th><th>وضعیت</th><th>پیشرفت</th><th>اقدام</th></tr></thead><tbody>
<tr><td>حراج پاییزه</td><td><span class="badge b-promo">تبلیغاتی</span></td><td><span class="badge s-sending">در حال ارسال</span></td><td>۶٬۲۰۰ از ۱۰٬۰۰۰</td><td><button class="btn danger">توقف</button></td></tr>
<tr><td>یادآوری پرداخت</td><td><span class="badge b-trx">خدماتی</span></td><td><span class="badge s-q">زمان‌بندی: ۱۴۰۵/۰۸/۰۵ ساعت ۱۰:۰۰</span></td><td>—</td><td><button class="btn">لغو زمان‌بندی</button></td></tr>
</tbody></table></div></section>
<h2 style="margin-top:24px">حالات دیگر</h2><div class="grid c3">
<div class="card" aria-busy="true">{SL("بارگذاری")}<div class="sk" style="width:60%"></div><div class="sk"></div><div class="sk" style="width:80%"></div><span class="hint">در حال دریافت اطلاعات…</span></div>
<div class="card empty">{SL("خالی")}<p><b>هنوز پیامکی ارسال نشده</b></p><p>اولین پیامک را بفرستید یا یک کمپین بسازید.</p><a class="btn primary" href="single-send.html">ارسال تکی</a></div>
<div class="card">{SL("خطا")}<div class="alert err" role="alert">بارگذاری داشبورد ناموفق بود. اتصال را بررسی کنید.</div><button class="btn">تلاش مجدد</button></div></div>''')
# 2 single send
page("single-send","ارسال تکی",f'''
<div class="grid side-r"><form class="card" novalidate aria-describedby="f-help"><p id="f-help" class="hint">فیلدهای ستاره‌دار الزامی است.</p>
<div class="field"><label for="to">گیرنده *</label><input id="to" class="ltr" inputmode="tel" autocomplete="off" value="۰۹۱۲۱۲۳۴۵۶۷" aria-describedby="to-h"><p id="to-h" class="hint">نام مشتری را جستجو کنید یا موبایل وارد کنید (ارقام فارسی و لاتین، ‎+98‎ پذیرفته می‌شود).</p></div>
<fieldset class="field" style="border:0;padding:0"><legend><b>نوع پیام *</b></legend><div class="row">
<label class="row" style="font-weight:400;opacity:.7"><input type="radio" name="k" disabled style="width:auto"> رمز یکبار مصرف (در این فرم غیرفعال)</label>
<label class="row" style="font-weight:400"><input type="radio" name="k" checked style="width:auto"> <span class="badge b-trx">خدماتی</span></label>
<label class="row" style="font-weight:400"><input type="radio" name="k" style="width:auto"> <span class="badge b-promo">تبلیغاتی</span></label></div></fieldset>
<div class="field"><label for="tpl">قالب</label><select id="tpl"><option>order.shipped — ارسال سفارش</option><option>متن آزاد</option></select></div>
<div class="grid c2"><div class="field"><label for="v1">orderNumber</label><input id="v1" class="ltr" value="TR-10452"></div><div class="field"><label for="v2">trackingLine</label><input id="v2" class="ltr" value="2384001"></div></div>
<div class="field"><label for="body">متن پیام</label><textarea id="body" aria-describedby="cnt">سفارش TR-10452 ارسال شد. کد رهگیری: 2384001</textarea>
<p id="cnt" class="hint" aria-live="polite">۴۸ نویسه + «لغو11» = ۵۴ نویسه · ۱ پارت (حد تک‌پارت ۷۰، چندپارت ۶۷)</p></div>
<div class="row"><button class="btn primary" type="submit">ارسال</button><button class="btn" type="button">زمان‌بندی</button></div></form>
<aside class="card" aria-label="پیش‌نمایش"><h2>پیش‌نمایش</h2><div class="phone"><div class="bubble">سفارش TR-10452 ارسال شد. کد رهگیری: 2384001
<span class="lock" aria-label="بخش ثابت و غیرقابل حذف">🔒 لغو11</span></div></div></aside></div>
<h2 style="margin-top:24px">حالات اعتبارسنجی و نتیجه</h2><div class="grid c2">
<div class="card">{SL("شماره نامعتبر")}<label for="e1">گیرنده</label><input id="e1" class="ltr" value="0912345" aria-invalid="true" aria-describedby="e1m"><p id="e1m" class="err">شماره موبایل معتبر نیست. نمونه درست: ۰۹۱۲۱۲۳۴۵۶۷</p></div>
<div class="card">{SL("لیست سیاه")}<div class="alert err" role="alert">این شماره در لیست سیاه است (دامنه: همه). ارسال ممکن نیست.</div></div>
<div class="card">{SL("لغوکرده")}<div class="alert warn" role="alert">این مشترک با «لغو۱۱» انصراف داده است. فقط پیام‌های الزامی سفارش جاری مجاز است.</div></div>
<div class="card">{SL("بدون رضایت (تبلیغاتی)")}<div class="alert err" role="alert">برای پیام تبلیغاتی رضایت صریح لازم است. این مشترک رضایت ثبت‌شده ندارد.</div></div>
<div class="card">{SL("خارج ساعت مجاز")}<div class="alert warn" role="alert">ارسال تبلیغاتی فقط ۰۸:۰۰ تا ۲۱:۰۰ به وقت تهران مجاز است.</div><button class="btn primary">زمان‌بندی برای فردا ۰۸:۰۰</button></div>
<div class="card">{SL("محدودیت نرخ")}<div class="alert warn" role="alert">تعداد درخواست‌ها زیاد است. لطفاً ۶۰ ثانیه دیگر دوباره تلاش کنید.</div></div>
<div class="card">{SL("در حال ارسال")}<button class="btn primary" aria-disabled="true" aria-busy="true">در حال ارسال…</button></div>
<div class="card">{SL("ارسال شد")}<div class="alert ok" role="status">پیامک ارسال شد. شناسه: <span class="ltr">MSG-88213471</span></div></div>
<div class="card">{SL("ناموفق")}<div class="alert err" role="alert">ارسال ناموفق بود: سرویس‌دهنده پاسخ نداد.</div><button class="btn">تلاش مجدد</button></div>
<div class="card">{SL("وضعیت نامشخص")}<div class="alert warn" role="alert"><b>ممکن است ارسال شده باشد؛ تکرار نکنید.</b> وضعیت از گزارش تحویل بررسی می‌شود.</div><a href="reports.html">مشاهده در گزارش‌ها</a></div></div>''')
# 3 wizard steps 1-4
page("campaign-wizard","کمپین جدید",f'''
<ol class="steps" aria-label="مراحل"><li class="done">۱. مخاطب ✓</li><li class="done">۲. پیام ✓</li><li class="done">۳. زمان ✓</li><li aria-current="step">۴. بازبینی</li><li>۵. تأیید</li><li>۶. تأیید مدیر</li></ol>
<section class="card"><h2>مرحله ۱ — مخاطب</h2><div class="tabs" role="tablist"><button role="tab" aria-selected="false">لیست</button><button role="tab" aria-selected="false">سگمنت</button><button role="tab" aria-selected="true">آپلود CSV</button></div>
<div class="drop">فایل CSV را اینجا رها کنید یا <button class="btn">انتخاب فایل</button><p class="hint">حداکثر ۵۰٬۰۰۰ ردیف · ستون اجباری: mobile</p></div>
<div class="row" style="margin-top:8px" role="status"><span class="badge s-dlv">معتبر: ۹٬۸۴۰</span><span class="badge s-q">تکراری: ۱۲۰</span><span class="badge s-fail">نامعتبر: ۴۰</span><a href="#">دانلود خطاها (CSV)</a></div>
<div class="alert err" role="alert" style="margin-top:8px">{SL("خطای CSV")} فایل بیش از ۵۰٬۰۰۰ ردیف دارد یا ستون mobile ندارد.</div></section>
<section class="card" style="margin-top:12px"><h2>مرحله ۲ — پیام</h2><p>قالب: <b>promo.generic</b> · نوع: <span class="badge b-promo">تبلیغاتی</span> · متغیرها: <span class="chip">{{name}}</span><span class="chip">{{city}}</span><span class="chip">{{link}}</span></p>
<p class="hint">پیش‌نمایش ۵ نمونه شخصی‌سازی‌شده:</p><ol><li>سارا عزیز، حراج پاییزه ترنم در تهران… لغو11</li><li>علی عزیز، … در اصفهان … لغو11</li><li>…</li></ol></section>
<section class="card" style="margin-top:12px"><h2>مرحله ۳ — زمان</h2><fieldset style="border:0;padding:0"><legend class="hint">زمان ارسال</legend><label class="row" style="font-weight:400"><input type="radio" name="t" style="width:auto"> اکنون</label><label class="row" style="font-weight:400"><input type="radio" name="t" checked style="width:auto"> زمان‌بندی</label></fieldset>
<div class="grid c2"><div><label for="d">تاریخ (جلالی)</label><input id="d" value="۱۴۰۵/۰۸/۰۶"></div><div><label for="h">ساعت (تهران)</label><select id="h"><option disabled>۰۷:۰۰ — غیرمجاز</option><option selected>۱۰:۰۰</option><option disabled>۲۱:۳۰ — غیرمجاز</option></select></div></div>
<p class="hint">ساعات خارج از ۰۸:۰۰–۲۱:۰۰ برای تبلیغاتی غیرفعال است.</p></section>
<section class="card" style="margin-top:12px" aria-labelledby="rv"><h2 id="rv">مرحله ۴ — بازبینی</h2><div class="grid c3">
<div class="kpi"><span>واجد شرایط</span><b>۹٬۴۱۲</b></div><div class="kpi"><span>پارت‌ها</span><b>۲ پارت × ۹٬۴۱۲ = ۱۸٬۸۲۴</b></div><div class="kpi"><span>هزینه برآوردی / اعتبار</span><b>— / ۱۲۸٬۴۰۰ واحد</b><span>نرخ هر پارت در spec نیامده</span></div></div>
<h3>ردشده‌ها: ۴۲۸</h3><table><tbody><tr><td>لغوکرده</td><td>۲۱۰</td></tr><tr><td>لیست سیاه</td><td>۳۴</td></tr><tr><td>بدون رضایت</td><td>۱۴۰</td></tr><tr><td>نامعتبر</td><td>۴۰</td></tr><tr><td>سقف فرکانس</td><td>۴</td></tr></tbody></table>
<div class="row" style="margin-top:12px"><button class="btn">ارسال آزمایشی به شماره‌های تست (حداکثر ۵)</button><button class="btn primary">آماده‌سازی برای تأیید</button></div>
<div class="alert err" role="alert" style="margin-top:12px">{SL("اعتبار ناکافی")} هزینه برآوردی بیشتر از اعتبار است. ارسال مسدود شد؛ ابتدا اعتبار را افزایش دهید.</div></section>''',credit="warn")
# 4 confirm modal
page("campaign-confirm","تأیید ارسال انبوه",f'''
<div class="modal-back"><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="mt" aria-describedby="md">
<h2 id="mt">⚠ تأیید نهایی ارسال انبوه</h2><div id="md"><p>این عمل غیرقابل بازگشت است و از اعتبار کسر می‌شود.</p>
<table><tbody><tr><th>گیرندگان</th><td><b>۹٬۴۱۲</b></td></tr><tr><th>مخاطب</th><td>CSV «مشتریان-پاییز.csv»</td></tr><tr><th>نوع</th><td><span class="badge b-promo">تبلیغاتی</span></td></tr>
<tr><th>پیام</th><td>{{name}} عزیز، حراج پاییزه… <span class="lock">🔒 لغو11</span></td></tr><tr><th>پارت</th><td>۱۲۱ نویسه · ۲ پارت · مجموع ۱۸٬۸۲۴</td></tr><tr><th>زمان</th><td>۱۴۰۵/۰۸/۰۶ ساعت ۱۰:۰۰ تهران</td></tr></tbody></table></div>
<p role="timer" aria-live="off" class="alert info">اعتبار این تأیید: <b>۰۹:۴۲</b> دقیقه</p>
<div class="field"><label for="cnt">برای تأیید، تعداد گیرندگان (۹٬۴۱۲) را تایپ کنید</label><input id="cnt" class="ltr" inputmode="numeric" value="9421" aria-invalid="true" aria-describedby="cnte"><p id="cnte" class="err">عدد واردشده با تعداد گیرندگان برابر نیست.</p></div>
<div class="field"><label for="otp">کد پیامکی ارسال‌شده به موبایل شما</label><input id="otp" class="ltr" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></div>
<div class="row"><button class="btn" autofocus>انصراف</button><button class="btn danger" aria-disabled="true">ارسال برای ۹٬۴۱۲ نفر</button></div>
<p class="hint">چون پیام تبلیغاتی است (یا بیش از ۱٬۰۰۰ گیرنده)، پس از تأیید شما، تأیید مدیر لازم است.</p></div></div>
<h2 style="margin-top:24px">حالات</h2><div class="grid c2">
<div class="card">{SL("توکن منقضی")}<div class="alert err" role="alert">مهلت ۱۰ دقیقه‌ای تأیید تمام شد. دوباره آماده کنید.</div><button class="btn primary">آماده‌سازی مجدد</button></div>
<div class="card">{SL("تغییر پس از آماده‌سازی")}<div class="alert warn" role="alert">متن، مخاطب یا زمان تغییر کرده و تأیید قبلی باطل شد. بازبینی را تکرار کنید.</div></div>
<div class="card">{SL("عدد صحیح")}<input class="ltr" value="9412" aria-label="تعداد گیرندگان"><p class="hint" style="color:var(--ok)">✓ عدد درست است</p><button class="btn danger">ارسال برای ۹٬۴۱۲ نفر</button></div>
<div class="card">{SL("ثبت شد")}<div class="alert ok" role="status">تأیید شما ثبت شد. وضعیت: در انتظار تأیید مدیر.</div></div></div>''')
# 5 approval
page("campaign-approval","تأیید مدیر — حراج پاییزه",f'''
<div class="card"><span class="badge s-q">در انتظار تأیید مدیر</span><p>سازنده: مریم احمدی · آماده‌سازی: ۱۴۰۵/۰۸/۰۴ ۱۵:۱۰</p>
<table><tbody><tr><th>گیرندگان</th><td>۹٬۴۱۲ (رد: ۴۲۸)</td></tr><tr><th>نوع</th><td><span class="badge b-promo">تبلیغاتی</span></td></tr><tr><th>پارت</th><td>۱۸٬۸۲۴</td></tr><tr><th>زمان</th><td>۱۴۰۵/۰۸/۰۶ ۱۰:۰۰</td></tr></tbody></table>
<div class="field" style="margin-top:12px"><label for="rs">دلیل رد (برای رد الزامی)</label><textarea id="rs" style="min-height:80px"></textarea></div>
<div class="row"><button class="btn" autofocus>بازگشت</button><button class="btn">رد کمپین</button><button class="btn danger">تأیید و شروع ارسال</button></div></div>
<div class="card" style="margin-top:12px">{SL("سازنده = تأییدکننده")}<button class="btn" aria-disabled="true" aria-describedby="self">تأیید و شروع ارسال</button><p id="self" class="hint">شما سازنده این کمپین هستید و نمی‌توانید آن را تأیید کنید. مدیر دیگری با نقش «تأییدکننده پیامک» باید تأیید کند.</p></div>''')
# 6 run
page("campaign-run","اجرای کمپین — حراج پاییزه",f'''
<div class="card"><div class="bar" role="img" aria-label="تحویل ۵۸۰۰، ارسال‌شده ۴۰۰، ناموفق ۱۲۰، در صف ۳۰۹۲"><span style="width:62%;background:#166534"></span><span style="width:4%;background:#0369a1"></span><span style="width:1.3%;background:#b91c1c"></span><span style="flex:1;background:#cbd5e1"></span></div>
<div class="row" style="margin-top:8px"><span class="badge s-dlv">تحویل ۵٬۸۰۰</span><span class="badge s-sent">ارسال‌شده ۴۰۰</span><span class="badge s-fail">ناموفق ۱۲۰</span><span class="badge s-q">در صف ۳٬۰۹۲</span></div>
<div class="row" style="margin-top:12px"><button class="btn danger">توقف اضطراری</button><button class="btn">لغو کمپین</button></div></div>
<div class="card" style="margin-top:12px">{SL("circuit breaker")}<div class="alert err" role="alert"><b>متوقف شد: نرخ خطای بالا</b> (بیش از ۲۰٪ در آخرین دسته). پیش از ادامه علت را بررسی کنید.</div><button class="btn">ادامه ارسال</button></div>
<div class="card" style="margin-top:12px">{SL("پایان")}<div class="alert ok" role="status">کمپین کامل شد.</div></div>''')
# 7 templates
page("templates","قالب‌ها",f'''
<div class="row" style="justify-content:space-between"><input aria-label="جستجوی قالب" placeholder="جستجو…" style="max-width:320px"><button class="btn primary">قالب جدید</button></div>
<div class="tablewrap card" style="margin-top:12px"><table><thead><tr><th>نام</th><th>کلید</th><th>نوع</th><th>نسخه</th><th>فعال</th></tr></thead><tbody>
<tr><td>ورود</td><td class="ltr">otp.login</td><td><span class="badge b-otp">رمز یکبار مصرف</span></td><td>۳</td><td>✓ بله</td></tr>
<tr><td>ارسال سفارش</td><td class="ltr">order.shipped</td><td><span class="badge b-trx">خدماتی</span></td><td>۲</td><td>✓ بله</td></tr>
<tr><td>واریز کمیسیون</td><td class="ltr">partner.commission.credited</td><td><span class="badge b-trx">خدماتی</span></td><td>۱</td><td>✓ بله</td></tr>
<tr><td>تبلیغاتی عمومی</td><td class="ltr">promo.generic</td><td><span class="badge b-promo">تبلیغاتی</span></td><td>۴</td><td>✗ خیر</td></tr></tbody></table></div>
<section class="card" style="margin-top:12px"><h2>ویرایش: واریز کمیسیون (نسخه ۱)</h2><p>متغیرهای مجاز (برای درج کلیک کنید): {"".join(f'<button class="chip">{{{v}}}</button>' for v in ["partnerName","amountToman","orderNumber","balanceToman","period"])}</p>
<label for="tb">متن</label><textarea id="tb" aria-invalid="true" aria-describedby="tbe">{{partnerName}} عزیز، مبلغ {{amountToman}} تومان واریز شد. {{bonus}}</textarea>
<p id="tbe" class="err">متغیر ناشناخته: {{bonus}} — فقط متغیرهای مجاز قابل استفاده است.</p>
<div class="field"><label for="vid">شناسه قالب verify (فقط برای رمز یکبار مصرف)</label><input id="vid" class="ltr" disabled placeholder="—"></div>
<details><summary>تاریخچه نسخه‌ها</summary><ul><li>نسخه ۱ — ۱۴۰۵/۰۸/۰۱ — ایجاد</li></ul></details>
<div class="row"><button class="btn primary">ذخیره نسخه جدید</button><button class="btn">پیش‌نمایش</button></div></section>''')
# 8 contacts
page("contacts","مخاطبان و سگمنت‌ها",f'''
<div class="tablewrap card"><table><thead><tr><th>نام</th><th>نوع</th><th>تعداد</th><th>آخرین به‌روزرسانی</th></tr></thead><tbody>
<tr><td>همکاران فروش</td><td>ایستا</td><td>۳۴۰</td><td>۱۴۰۵/۰۸/۰۳</td></tr><tr><td>خریداران عمده تهران</td><td>پویا</td><td>۱٬۲۸۰</td><td>زنده</td></tr>
<tr><td>واردات آبان</td><td>ایستا</td><td><span class="badge s-sending" role="status">در حال پردازش import… ۴۲٪</span></td><td>—</td></tr></tbody></table></div>
<section class="card" style="margin-top:12px"><h2>سازنده سگمنت</h2><div class="grid c3">
<div><label for="c">کانال</label><select id="c"><option>عمده</option><option>تکی</option></select></div><div><label for="ct">شهر</label><input id="ct" value="تهران"></div>
<div><label for="oc">تعداد سفارش حداقل</label><input id="oc" inputmode="numeric" value="۳"></div><div><label for="lp">آخرین خرید</label><select id="lp"><option>۹۰ روز اخیر</option></select></div>
<div><label for="sp">همکار فروش</label><select id="sp"><option>همه</option></select></div><div><label for="tg">برچسب</label><input id="tg"></div></div>
<p role="status" aria-live="polite" style="margin-top:12px">شمارش زنده: <b>۱٬۲۸۰</b> مشتری</p><button class="btn primary">ذخیره سگمنت</button></section>
<div class="grid c2" style="margin-top:12px"><div class="card empty">{SL("خالی")}<p><b>هنوز لیستی ندارید</b></p><button class="btn primary">ساخت لیست</button></div>
<div class="card">{SL("خطای CSV")}<div class="alert err" role="alert">ردیف ۱۸: شماره نامعتبر. ۴۰ ردیف رد شد.</div><a href="#">دانلود گزارش خطا</a></div></div>''')
# 9 reports
B=[("s-q","در صف"),("s-sending","در حال ارسال"),("s-sent","ارسال‌شده"),("s-dlv","تحویل"),("s-und","عدم تحویل"),("s-fail","ناموفق"),("s-skip","ردشده"),("s-unk","نامشخص"),("s-cnl","لغوشده")]
rows="".join(f'<tr><td class="ltr">0912***{4500+i}</td><td>حراج پاییزه</td><td><span class="badge {c}" role="status" aria-label="وضعیت: {t}">{t}</span></td><td>{"۱۲۳۴۵"[i%5]}</td><td><button class="btn">جزئیات</button></td></tr>' for i,(c,t) in enumerate(B))
page("reports","گزارش‌ها",f'''
<form class="card grid c5" role="search"><div><label for="r1">بازه</label><input id="r1" value="۱۴۰۵/۰۸/۰۱ تا ۱۴۰۵/۰۸/۰۴"></div><div><label for="r2">کمپین</label><select id="r2"><option>همه</option></select></div>
<div><label for="r3">وضعیت</label><select id="r3"><option>همه</option></select></div><div><label for="r4">نوع</label><select id="r4"><option>همه</option></select></div><div><label for="r5">شماره</label><input id="r5" class="ltr"></div></form>
<div class="row" style="margin:12px 0;justify-content:flex-end"><button class="btn">خروجی CSV</button><span class="hint">برای نقش غیرادمین، موبایل‌ها ماسک می‌شوند.</span></div>
<div class="grid side-r"><div class="tablewrap card"><table><thead><tr><th>موبایل</th><th>کمپین</th><th>وضعیت</th><th>تلاش</th><th></th></tr></thead><tbody>{rows}</tbody></table></div>
<aside class="card drawer" aria-label="جزئیات پیام"><h2>جزئیات پیام</h2><ol class="tl"><li>۱۰:۰۰:۰۲ — تلاش ۱: مهلت پاسخ تمام شد</li><li>۱۰:۰۰:۳۵ — تلاش ۲: ارسال‌شده (MSG-88213)</li><li>۱۰:۰۲:۱۰ — تحویل</li></ol><button class="btn">بستن</button></aside></div>''')
# 10 optout
page("optout","لغو و لیست سیاه",f'''
<div class="tabs" role="tablist"><button role="tab" aria-selected="true">لغوها</button><button role="tab" aria-selected="false">لیست سیاه</button></div>
<div class="row"><button class="btn primary">افزودن دستی</button><button class="btn">ورود CSV</button></div>
<div class="tablewrap card" style="margin-top:12px"><table><thead><tr><th>موبایل</th><th>منبع</th><th>تاریخ</th><th>دامنه</th><th></th></tr></thead><tbody>
<tr><td class="ltr">0912***4567</td><td>پیامک ۱۱</td><td>۱۴۰۵/۰۸/۰۳</td><td>تبلیغاتی</td><td><button class="btn">حذف</button></td></tr>
<tr><td class="ltr">0935***1200</td><td>پرتال</td><td>۱۴۰۵/۰۸/۰۲</td><td>همه</td><td><button class="btn">حذف</button></td></tr>
<tr><td class="ltr">0919***0081</td><td>provider</td><td>۱۴۰۵/۰۸/۰۱</td><td>همه</td><td><button class="btn">حذف</button></td></tr></tbody></table></div>
<div class="grid c2" style="margin-top:12px"><form class="card"><h2>افزودن دستی</h2><label for="m">موبایل</label><input id="m" class="ltr"><label for="why" style="margin-top:8px">دلیل *</label><textarea id="why" aria-invalid="true" aria-describedby="whye" style="min-height:70px"></textarea><p id="whye" class="err">وارد کردن دلیل الزامی است.</p><button class="btn primary">افزودن</button></form>
<div class="card"><h2>پیام‌های دریافتی تشخیص‌داده‌نشده</h2><table><tbody><tr><td class="ltr">0912***3311</td><td>«دیگه نفرستید»</td><td><button class="btn">ثبت لغو</button> <button class="btn">نادیده</button></td></tr></tbody></table></div></div>
<div class="modal-back" style="margin-top:12px"><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="dl"><h2 id="dl">حذف از لیست لغو؟</h2><p>با حذف، این شماره دوباره پیام دریافت می‌کند.</p><div class="row"><button class="btn" autofocus>انصراف</button><button class="btn danger">حذف</button></div></div></div>''')
# 11 audit
page("audit","گزارش فعالیت",f'''
<form class="card row" role="search"><input aria-label="جستجو" placeholder="جستجو در کاربر، اکشن، هدف…" style="max-width:360px"><select aria-label="اکشن" style="max-width:220px"><option>همه اکشن‌ها</option></select></form>
<div class="tablewrap card" style="margin-top:12px"><table><caption class="hint" style="text-align:start">فقط‌خواندنی</caption><thead><tr><th>زمان</th><th>کاربر</th><th>اکشن</th><th>هدف</th><th>جزئیات</th></tr></thead><tbody>
<tr><td>۱۴۰۵/۰۸/۰۴ ۱۵:۱۲</td><td>مریم احمدی</td><td class="ltr">campaign.confirm</td><td>حراج پاییزه</td><td><details><summary>diff</summary><pre class="ltr">status: DRAFT → PENDING_APPROVAL</pre></details></td></tr>
<tr><td>۱۴۰۵/۰۸/۰۴ ۱۱:۰۵</td><td>رضا کریمی</td><td class="ltr">settings.update</td><td>تنظیمات</td><td><details><summary>diff</summary><pre class="ltr">quietEnd: 21:00 → 20:00</pre></details></td></tr></tbody></table></div>
<div class="card" style="margin-top:12px">{SL("بدون دسترسی ۴۰۳")}<div class="alert err" role="alert">برای دیدن این صفحه نقش «مدیر پیامک» لازم است. از مدیر سامانه درخواست دسترسی کنید.</div></div>''')
# 12 settings
page("settings","تنظیمات پیامک",f'''
<form class="card"><div class="grid c2"><div class="field"><label for="q1">شروع ساعت مجاز تبلیغاتی</label><input id="q1" value="۰۸:۰۰"></div><div class="field"><label for="q2">پایان</label><input id="q2" value="۲۱:۳۰" aria-invalid="true" aria-describedby="q2e"><p id="q2e" class="err">بازه فقط می‌تواند محدودتر از ۰۸:۰۰–۲۱:۰۰ باشد.</p></div>
<div class="field"><label for="f1">سقف فرکانس تبلیغاتی</label><input id="f1" value="۱ در روز · ۳ در هفته"></div><div class="field"><label for="a1">آستانه هشدار اعتبار</label><input id="a1" value="۵٬۰۰۰"></div>
<div class="field"><label for="tn">شماره‌های تست (حداکثر ۵)</label><textarea id="tn" class="ltr" style="min-height:70px">09120000001</textarea></div><div class="field"><label for="pv">provider فعال</label><select id="pv"><option>sms.ir</option><option>mock</option></select></div></div>
<h2>کلیدها</h2><ul><li>SMSIR_API_KEY: <span class="badge s-dlv">تنظیم شده ✓</span></li><li>SMSIR_OTP_TEMPLATE_ID: <span class="badge s-fail">تنظیم نشده ✗</span></li><li>SMS_EGRESS_SECRET: <span class="badge s-dlv">تنظیم شده ✓</span></li></ul><p class="hint">مقدار کلیدها هرگز نمایش داده نمی‌شود.</p>
<div class="row"><button class="btn primary">ذخیره</button><button class="btn">تست اتصال</button></div><div class="alert ok" role="status" style="margin-top:12px">{SL("تست موفق")} اتصال برقرار است.</div></form>''')
# 13 components/states
page("states","کامپوننت‌ها و حالات سراسری",f'''
<section class="card"><h2>badge نوع پیام</h2><div class="row"><span class="badge b-otp">رمز یکبار مصرف</span><span class="badge b-trx">خدماتی</span><span class="badge b-promo">تبلیغاتی</span></div>
<h2 style="margin-top:12px">badge وضعیت</h2><div class="row">{"".join(f'<span class="badge {c}">{t}</span>' for c,t in B)}</div></section>
<section class="card" style="margin-top:12px"><h2>کارت اعتبار</h2><div class="row"><div class="credit">اعتبار: <b>۱۲۸٬۴۰۰</b></div><div class="credit warn">⚠ ۴٬۲۰۰</div><div class="credit low">⛔ ۸۰۰ ناکافی</div><div class="credit">اعتبار: نامشخص <button class="btn" style="min-height:32px">تلاش مجدد</button></div></div></section>
<section class="grid c2" style="margin-top:12px"><div class="card">{SL("۴۰۳")}<div class="alert err" role="alert">شما به این بخش دسترسی ندارید. نقش لازم: «بازاریاب پیامک».</div></div><div class="card">{SL("قطع اتصال provider")}<div class="alert warn" role="alert">اتصال به sms.ir برقرار نیست. ارسال‌ها در صف می‌مانند.</div></div></section>''',credit="low")
print("ok")
