'use client';

import { use } from 'react';
import { AccountSupportTickets } from '@/components/support/AccountSupportTickets';

export default function RetailAccountSupportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AccountSupportTickets
      variant="retail"
      mode="detail"
      ticketId={id}
      listHref="/account/support"
      newHref="/account/support/new"
      detailHref={(tid) => `/account/support/${tid}`}
    />
  );
}
