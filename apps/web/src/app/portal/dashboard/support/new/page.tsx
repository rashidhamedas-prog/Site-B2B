'use client';

import { AccountSupportTickets } from '@/components/support/AccountSupportTickets';

export default function PortalSupportNewPage() {
  return (
    <AccountSupportTickets
      variant="wholesale"
      mode="new"
      listHref="/portal/dashboard/support"
      newHref="/portal/dashboard/support/new"
      detailHref={(id) => `/portal/dashboard/support/${id}`}
    />
  );
}
