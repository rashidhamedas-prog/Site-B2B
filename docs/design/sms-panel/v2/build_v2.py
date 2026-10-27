# v2 mockups: reuses v1 CSS/page() shell (lines 1-84 of ../ui/build.py), writes to ./screens
import pathlib,re
src=(pathlib.Path(__file__).parent/"../ui/build.py").read_text(encoding="utf-8").split("\nSL=")[0]
g={"__file__":__file__};exec(src,g)
g["OUT"]=pathlib.Path(__file__).parent/"screens"
g["CSS"]+=""".srcs{display:grid;gap:8px}.srcs label{display:flex;gap:10px;align-items:center;min-height:44px;border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-weight:400}
.srcs input{width:22px;min-height:22px;height:22px}.rule{display:grid;gap:8px;grid-template-columns:1fr;border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px}
.sticky{position:sticky;top:72px}.est{font-size:12px;font-weight:700;background:var(--warn-bg);color:var(--warn);border-radius:6px;padding:0 6px}
dl.kv{display:grid;grid-template-columns:auto auto;gap:4px 12px;margin:0}dl.kv dd{margin:0;text-align:end;font-weight:700}
.bottombar{position:sticky;bottom:0;background:#fff;border-top:1px solid var(--border);padding:8px 12px;display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:12px}
@media (min-width:768px){.rule{grid-template-columns:1.2fr 1fr 1.4fr auto}}
@media (min-width:1024px){.bottombar{display:none}}"""
g["NAV"][2]=("bulk-audience","ارسال انبوه");g["ALIAS"].update({"bulk-compose":"bulk-audience","bulk-schedule":"bulk-audience","bulk-confirm":"bulk-audience"})
page=g["page"]
SL=lambda t:f'<span class="state-label">حالت: {t}</span>'
STEPS=lambda n:'<ol class="steps" aria-label="مراحل ارسال انبوه">'+"".join(f'<li{" aria-current=step" if i==n else (" class=done" if i<n else "")}>{i+1}. {t}</li>' for i,t in enumerate(["مخاطبان","متن","زمان‌بندی","بازبینی و تأیید"]))+'</ol>'
PREVIEW=lambda partial="":f'''<aside class="card sticky" aria-labelledby="pv"><h2 id="pv">پیش‌نمایش گیرندگان</h2>
<div role="status" aria-live="polite" aria-atomic="true"><dl class="kv">
<dt>کل انتخاب‌شده (۳ منبع)</dt><dd>۱۸٬۹۲۰</dd><dt>− تکراری (شماره یکسان)</dt><dd>۲٬۱۴۰</dd>
<dt>− لغو/لیست سیاه</dt><dd>۶۱۰</dd><dt>− بدون رضایت تبلیغاتی</dt><dd>۱٬۰۲۵</dd><dt>− شماره نامعتبر</dt><dd>۸۵</dd>
<dt><b>گیرنده نهایی</b></dt><dd style="font-size:20px">۱۵٬۰۶۰</dd>
<dt>پارت هر پیام</dt><dd>۲</dd><dt>کل پارت (= مصرف اعتبار)</dt><dd>۳۰٬۱۲۰ پیامک</dd>
<dt>هزینه ریالی</dt><dd>نامشخص <span class="est">برآورد</span></dd></dl></div>
<p class="hint">اعداد در لحظه ارسال دوباره محاسبه می‌شوند (سگمنت پویا). {partial}</p>
<button class="btn" style="width:100%">دیدن نمونه ۲۰ گیرنده</button></aside>'''

page("bulk-audience","ارسال انبوه — مخاطبان",STEPS(0)+f'''<div class="grid side-r"><div>
<section class="card"><h2 id="srch">منبع مخاطبان</h2><fieldset class="srcs" aria-labelledby="srch" style="border:0;padding:0;margin:0">
<label><input type="checkbox" checked> مشتریان سایت عمده <span class="ltr hint">poshaktaranom.com</span> <span class="badge s-q">۹٬۸۴۰</span></label>
<label><input type="checkbox" checked> مشتریان سایت خرده <span class="ltr hint">poshaktaranom.ir</span> <span class="badge s-q">۷٬۶۱۰</span></label>
<label><input type="checkbox" checked> همکاران بازاریاب <span class="badge s-q">۱٬۴۷۰</span></label></fieldset>
<p class="hint">شماره‌های تکراری بین منابع یک‌بار شمرده و یک‌بار ارسال می‌شوند. لغو/لیست سیاه همیشه حذف است و قابل خاموش‌کردن نیست.</p></section>
<section class="card" style="margin-top:12px"><div class="row" style="justify-content:space-between"><h2>فیلترها</h2>
<label style="margin:0;font-weight:400">سگمنت ذخیره‌شده: <select style="width:auto"><option>— بدون —</option><option>عمده‌خرهای تهران ۹۰ روز</option></select></label></div>
<p class="hint">همه شرط‌ها باید برقرار باشند (و).</p>
<div class="rule"><select aria-label="فیلد"><option>شهر</option></select><select aria-label="عملگر"><option>یکی از</option></select><input aria-label="مقدار" value="تهران، کرج"><button class="btn" aria-label="حذف شرط شهر">✕</button></div>
<div class="rule"><select aria-label="فیلد"><option>تاریخ آخرین سفارش</option></select><select aria-label="عملگر"><option>در ... روز اخیر</option></select><input aria-label="مقدار" value="۹۰" inputmode="numeric"><button class="btn" aria-label="حذف شرط آخرین سفارش">✕</button></div>
<div class="rule"><select aria-label="فیلد"><option>جمع مبلغ سفارش‌ها (تومان)</option></select><select aria-label="عملگر"><option>بیشتر از</option></select><input aria-label="مقدار" value="۵٬۰۰۰٬۰۰۰" inputmode="numeric"><button class="btn" aria-label="حذف شرط مبلغ">✕</button></div>
<div class="row"><button class="btn">+ افزودن شرط</button><button class="btn">ذخیره به‌عنوان سگمنت</button></div>
<p class="hint">فیلدهای موجود: منبع، شهر/استان، تاریخ آخرین سفارش، تعداد سفارش، جمع مبلغ، وضعیت همکار بازاریاب (فعال/غیرفعال/در انتظار)، برچسب‌ها، تاریخ عضویت. فیلدی که برای یک منبع معنا ندارد (مثلاً «وضعیت همکار» برای مشتری خرده) با توضیح «فقط روی همکاران اعمال می‌شود» نمایش داده شود.</p></section></div>
{PREVIEW()}</div>
<div class="bottombar" aria-hidden="false"><span><b>۱۵٬۰۶۰</b> گیرنده · ۳۰٬۱۲۰ پیامک</span><button class="btn primary">بعدی: متن</button></div>
<div class="row" style="margin-top:12px"><button class="btn primary">بعدی: متن</button><button class="btn">ذخیره پیش‌نویس</button></div>''')

page("bulk-compose","ارسال انبوه — متن",STEPS(1)+f'''<div class="grid side-r"><div class="card">
<div class="field"><label for="tp">قالب</label><select id="tp"><option>حراج پاییزه (تبلیغاتی)</option></select></div>
<div class="field"><label for="tx">متن پیام</label><textarea id="tx" aria-describedby="cnt">{{نام}} عزیز، حراج پاییزه پوشاک ترنم تا ۳۰٪ تخفیف. کد شما: {{کد_تخفیف}}</textarea>
<div class="row"><span class="hint">متغیرها:</span><button class="chip">{{نام}}</button><button class="chip">{{شهر}}</button><button class="chip">{{کد_تخفیف}}</button><button class="chip">{{لینک_سایت}}</button></div>
<p id="cnt" class="hint" role="status" aria-live="polite">بیشترین طول پس از جایگذاری: ۹۸ نویسه (با «لغو11») → <b>۲ پارت</b> · فارسی/UCS-2: تا ۷۰ نویسه ۱ پارت، بیشتر هر ۶۷ نویسه ۱ پارت.</p></div>
<div class="alert warn">۳۱۲ گیرنده «شهر» ندارند؛ برای آن‌ها مقدار جایگزین: <input aria-label="مقدار جایگزین شهر" value="ایران" style="width:140px;display:inline-block"></div>
<p class="hint">پیام بلند ۲ پارت، «لغو11» قفل‌شده و حذف‌نشدنی است.</p></div>
<div><div class="phone" aria-label="پیش‌نمایش با داده نمونه"><div class="bubble">مریم عزیز، حراج پاییزه پوشاک ترنم تا ۳۰٪ تخفیف. کد شما: <span class="ltr">TRN-4821</span>
<span class="lock">🔒 لغو11</span></div></div>
<label for="smp" style="margin-top:8px">نمایش با گیرنده نمونه</label><select id="smp"><option>مریم — عمده — تهران</option></select></div></div>
<div class="row" style="margin-top:12px"><button class="btn">قبلی</button><button class="btn primary">بعدی: زمان‌بندی</button></div>''')

page("bulk-schedule","ارسال انبوه — زمان‌بندی",STEPS(2)+'''<div class="card"><fieldset style="border:0;padding:0" class="srcs"><legend><b>زمان ارسال</b></legend>
<label><input type="radio" name="w"> هم‌اکنون (فقط در ساعات مجاز)</label><label><input type="radio" name="w" checked> زمان‌بندی</label></fieldset>
<div class="grid c2"><div class="field"><label for="d">تاریخ (جلالی)</label><input id="d" value="۱۴۰۵/۰۸/۱۰"></div>
<div class="field"><label for="t">ساعت (تهران)</label><input id="t" class="ltr" value="21:40" aria-invalid="true" aria-describedby="te"><p id="te" class="err">خارج از ساعات مجاز تبلیغاتی (۰۸:۰۰ تا ۲۱:۰۰).</p></div></div>
<div class="alert warn">ساعات مجاز ۰۸:۰۰–۲۱:۰۰ تهران تنظیم فعلی پنل است؛ مبنای رسمی آن <b>هنوز تأیید نشده</b>. <button class="btn">انتقال به ۱۴۰۵/۰۸/۱۱ ساعت ۰۸:۰۰</button></div>
<p class="hint">ارسال ۱۵٬۰۶۰ گیرنده در دسته‌های ۱۰۰تایی؛ اگر تا ۲۱:۰۰ تمام نشود باقی‌مانده به ۰۸:۰۰ روز بعد موکول می‌شود (نمایش «برآورد پایان»).</p></div>
<div class="row" style="margin-top:12px"><button class="btn">قبلی</button><button class="btn primary" aria-disabled="true">بعدی: بازبینی</button></div>''')

page("bulk-confirm","ارسال انبوه — بازبینی و تأیید",STEPS(3)+'''<div class="grid c2"><section class="card"><h2>خلاصه</h2><dl class="kv">
<dt>منابع</dt><dd>عمده، خرده، همکاران</dd><dt>فیلترها</dt><dd>تهران/کرج · ۹۰ روز · &gt;۵م</dd><dt>گیرنده نهایی</dt><dd>۱۵٬۰۶۰</dd>
<dt>پارت × گیرنده</dt><dd>۲ × ۱۵٬۰۶۰ = ۳۰٬۱۲۰ پیامک</dd><dt>اعتبار فعلی / پس از ارسال</dt><dd>۱۲۸٬۴۰۰ / ۹۸٬۲۸۰</dd>
<dt>هزینه ریالی</dt><dd>نامشخص <span class="est">برآورد</span></dd><dt>زمان</dt><dd>۱۴۰۵/۰۸/۱۱ ۰۸:۰۰ تهران</dd></dl>
<button class="btn" style="margin-top:8px">ارسال آزمایشی به شماره‌های تست (≤۵)</button></section>
<div class="modal-back"><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="mt" aria-describedby="md"><h2 id="mt">ارسال به ۱۵٬۰۶۰ نفر؟</h2>
<p id="md">۳۰٬۱۲۰ پیامک از اعتبار کم می‌شود. این کار پس از شروع فقط قابل توقف است، نه بازگشت.</p>
<div class="field"><label for="cf">برای تأیید، تعداد گیرندگان را بنویسید</label><input id="cf" inputmode="numeric" class="ltr"></div>
<div class="row"><button class="btn" autofocus>انصراف</button><button class="btn danger" aria-disabled="true">زمان‌بندی ارسال</button></div>
<p class="hint">اگر تعداد گیرنده بیش از آستانه تأیید مدیر باشد، به‌جای ارسال «درخواست تأیید» ثبت می‌شود.</p></div></div></div>''')

page("single-send","ارسال تکی",'''<div class="grid side-r"><div class="card">
<div class="field"><label for="to">گیرنده</label><input id="to" class="ltr" inputmode="tel" value="۰۹۱۲ ۳۴۵ ۶۷۸۹" aria-describedby="toh"><p id="toh" class="hint">شماره یا جستجوی نام در هر ۳ منبع.</p></div>
<div class="alert info">پیدا شد: مریم احمدی · <span class="badge s-q">عمده</span> <span class="badge s-q">همکار بازاریاب</span> · رضایت تبلیغاتی ✓ · لغو نکرده</div>
<div class="field"><label for="cl">نوع</label><select id="cl"><option>خدماتی</option><option>تبلیغاتی</option></select></div>
<div class="field"><label for="tt">قالب</label><select id="tt"><option>ارسال سفارش</option></select></div>
<div class="field"><label for="m">متن</label><textarea id="m">{نام} عزیز، سفارش {شماره_سفارش} ارسال شد.</textarea><p class="hint" role="status" aria-live="polite">۴۳ نویسه · ۱ پارت · ۱ پیامک</p></div>
<button class="btn primary">ارسال</button></div>
<div class="phone"><div class="bubble">مریم عزیز، سفارش <span class="ltr">#18234</span> ارسال شد.</div></div></div>''')

page("templates","قالب‌ها",'''<div class="row" style="justify-content:space-between"><input aria-label="جستجوی قالب" placeholder="جستجو…" style="max-width:320px"><button class="btn primary">+ قالب جدید</button></div>
<div class="tablewrap card" style="margin-top:12px"><table><thead><tr><th>نام</th><th>نوع</th><th>متغیرها</th><th>پارت (تخمین)</th><th>آخرین استفاده</th><th>اقدام</th></tr></thead><tbody>
<tr><td>حراج پاییزه</td><td><span class="badge b-promo">تبلیغاتی</span></td><td><span class="chip">{نام}</span><span class="chip">{کد_تخفیف}</span></td><td>۲</td><td>۱۴۰۵/۰۷/۲۸</td><td><button class="btn">ویرایش</button> <button class="btn">کپی</button></td></tr>
<tr><td>ارسال سفارش</td><td><span class="badge b-trx">خدماتی</span></td><td><span class="chip">{نام}</span><span class="chip">{شماره_سفارش}</span></td><td>۱</td><td>امروز</td><td><button class="btn">ویرایش</button> <button class="btn">کپی</button></td></tr>
</tbody></table></div><p class="hint">متغیر ناشناخته در ذخیره خطا می‌دهد؛ متغیرهای مجاز به منبع وابسته‌اند (مثلاً {کد_همکار} فقط برای همکاران).</p>''')

page("contacts","مخاطبان و سگمنت‌ها",'''<div class="tabs" role="tablist"><button role="tab" aria-selected="true">مخاطبان</button><button role="tab" aria-selected="false">سگمنت‌ها</button></div>
<div class="row"><select aria-label="منبع" style="width:auto"><option>همه منابع</option><option>عمده</option><option>خرده</option><option>همکاران</option></select><input aria-label="جستجو" placeholder="نام یا شماره" style="max-width:280px"></div>
<div class="tablewrap card" style="margin-top:12px"><table><thead><tr><th>نام</th><th>موبایل</th><th>منبع</th><th>شهر</th><th>آخرین سفارش</th><th>رضایت</th></tr></thead><tbody>
<tr><td>مریم احمدی</td><td class="ltr">0912 *** 6789</td><td><span class="badge s-q">عمده</span> <span class="badge s-q">همکار</span></td><td>تهران</td><td>۱۴۰۵/۰۷/۲۰</td><td><span class="badge s-dlv">دارد</span></td></tr>
<tr><td>رضا کریمی</td><td class="ltr">0935 *** 1102</td><td><span class="badge s-q">خرده</span></td><td>شیراز</td><td>—</td><td><span class="badge s-cnl">لغو کرده</span></td></tr></tbody></table></div>
<p class="hint">یک ردیف = یک شماره نرمال‌شده؛ عضویت در چند منبع با چند badge.</p>''')

page("states","حالات و کامپوننت‌های v2",f'''<div class="grid c2">
<div class="card">{SL("بارگذاری پیش‌نمایش")}<div aria-busy="true"><div class="sk"></div><div class="sk" style="width:60%"></div></div><p class="hint">در حال محاسبه… (debounce ۴۰۰ms؛ عدد قبلی کم‌رنگ می‌ماند)</p></div>
<div class="card">{SL("خالی — هیچ منبعی انتخاب نشده")}<div class="empty">حداقل یک منبع مخاطب انتخاب کنید.</div></div>
<div class="card">{SL("صفر گیرنده")}<div class="empty">با این فیلترها گیرنده‌ای باقی نماند. <button class="btn">برداشتن آخرین شرط</button></div></div>
<div class="card">{SL("خطای منبع")}<div class="alert err">داده «poshaktaranom.ir» در دسترس نیست. شمارش بدون این منبع است. <button class="btn">تلاش مجدد</button></div></div>
<div class="card">{SL("اعتبار ناکافی")}<div class="alert err">۳۰٬۱۲۰ پیامک لازم است، اعتبار ۸۰۰. ارسال غیرفعال است.</div></div>
<div class="card">{SL("قیمت واحد نامشخص")}<p>هزینه: نامشخص <span class="est">برآورد</span> — مصرف به پیامک دقیق است.</p></div></div>''')
