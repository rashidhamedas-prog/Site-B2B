import { SalesPartnerConfirm } from '@/components/sales-partners/SalesPartnerConfirm';

export default async function SalesPartnerConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SalesPartnerConfirm token={token} />;
}
