'use client';

import { AccountSupportTickets } from '@/components/support/AccountSupportTickets';

export default function RetailAccountSupportPage() {
  return (
    <AccountSupportTickets
      variant="retail"
      mode="list"
      listHref="/account/support"
      newHref="/account/support/new"
      detailHref={(id) => `/account/support/${id}`}
    />
  );
}
