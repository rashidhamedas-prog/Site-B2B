'use client';

import { AccountSupportTickets } from '@/components/support/AccountSupportTickets';

export default function RetailAccountSupportNewPage() {
  return (
    <AccountSupportTickets
      variant="retail"
      mode="new"
      listHref="/account/support"
      newHref="/account/support/new"
      detailHref={(id) => `/account/support/${id}`}
    />
  );
}
