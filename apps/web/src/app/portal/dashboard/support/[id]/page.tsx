'use client';

import { use } from 'react';
import { AccountSupportTickets } from '@/components/support/AccountSupportTickets';

export default function PortalSupportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AccountSupportTickets
      variant="wholesale"
      mode="detail"
      ticketId={id}
      listHref="/portal/dashboard/support"
      newHref="/portal/dashboard/support/new"
      detailHref={(tid) => `/portal/dashboard/support/${tid}`}
    />
  );
}
