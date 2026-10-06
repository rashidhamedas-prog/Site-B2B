import {
  noticeIsVisible,
  pickNoticeBanner,
  prepareSalesPartnerNotice,
  safeNoticeHref,
} from './sales-partner-notice-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const now = new Date('2026-10-06T09:00:00.000Z');

const ok = prepareSalesPartnerNotice(
  {
    title: '  <b>تخفیف</b> پاییز  ',
    body: 'کاپشن‌ها تا جمعه معرفی شوند.\n\nلینک کاتالوگ را بفرستید.',
    tone: 'important',
    linkUrl: '/sales-partners/catalog',
  },
  now,
);
assert(ok.ok, 'valid notice');
if (ok.ok) {
  assert(ok.value.title === 'تخفیف پاییز', 'tags stripped');
  assert(ok.value.body.includes('\n\n'), 'paragraph kept');
  assert(!ok.value.body.includes('<'), 'no markup in body');
  assert(ok.value.linkLabel === 'مشاهده', 'default label');
  assert(ok.value.audience === 'ACTIVE', 'active audience');
}

const empty = prepareSalesPartnerNotice({ title: ' ', body: 'متن کافی', tone: 'info' }, now);
assert(empty.ok === false && empty.error === 'عنوان اطلاعیه را بنویسید', 'empty title');

const script = prepareSalesPartnerNotice(
  { title: 'هشدار', body: 'متن', tone: 'info', linkUrl: 'javascript:alert(1)' },
  now,
);
assert(!script.ok, 'javascript link rejected');
assert(safeNoticeHref('//evil.example') === null, 'protocol relative rejected');
assert(safeNoticeHref('http://example.com') === null, 'http rejected');
assert(safeNoticeHref('https://user:pass@example.com/a') === null, 'credentials rejected');
assert(safeNoticeHref('https://poshaktaranom.ir/sales-partnership')?.startsWith('https://'), 'https allowed');

const expired = prepareSalesPartnerNotice(
  { title: 'تمام شد', body: 'متن اطلاعیه', tone: 'info', expiresAt: '2026-10-01T00:00:00.000Z' },
  now,
);
assert(expired.ok === false && expired.error === 'تاریخ پایان باید جلوتر از الان باشد', 'past expiry');

const future = prepareSalesPartnerNotice(
  { title: 'مهلت', body: 'متن اطلاعیه', tone: 'urgent', expiresAt: '2026-10-20T00:00:00.000Z' },
  now,
);
assert(future.ok, 'future expiry');

assert(
  !noticeIsVisible({ publishedAt: now, archivedAt: now, expiresAt: null }, now),
  'archived hidden',
);
assert(
  !noticeIsVisible({ publishedAt: now, expiresAt: now, archivedAt: null }, now),
  'expired hidden',
);
assert(noticeIsVisible({ publishedAt: now, expiresAt: null, archivedAt: null }, now), 'open visible');

const banner = pickNoticeBanner([
  { id: 'new-info', tone: 'info' as const, publishedAt: '2026-10-06T08:00:00.000Z', dismissed: false },
  { id: 'old-urgent', tone: 'urgent' as const, publishedAt: '2026-10-05T08:00:00.000Z', dismissed: false },
  { id: 'closed', tone: 'urgent' as const, publishedAt: '2026-10-06T08:30:00.000Z', dismissed: true },
]);
assert(banner?.id === 'old-urgent', 'urgent beats newer info and dismissed is skipped');

console.log('sales-partner-notice-policy.spec.ts ok');
