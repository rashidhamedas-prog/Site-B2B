'use client';

import { AccountSupportTickets } from '@/components/support/AccountSupportTickets';

export default function PortalSupportPage() {
  return (
    <AccountSupportTickets
      variant="wholesale"
      mode="list"
      listHref="/portal/dashboard/support"
      newHref="/portal/dashboard/support/new"
      detailHref={(id) => `/portal/dashboard/support/${id}`}
    />
  );
}
