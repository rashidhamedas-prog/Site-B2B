import { SalesPartnerShell } from '@/components/sales-partners/SalesPartnerShell';
import { SalesPartnerNoticeList } from '@/components/sales-partners/SalesPartnerNotices';

export default function SalesPartnerNoticesPage() {
  return (
    <SalesPartnerShell title="اطلاعیه‌ها">
      <SalesPartnerNoticeList />
    </SalesPartnerShell>
  );
}
