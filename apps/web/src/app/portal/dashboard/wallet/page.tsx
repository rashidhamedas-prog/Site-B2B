import type { Metadata } from 'next';
import { ShopperWalletBook } from '@/components/admin/AdminCustomerWallet';

export const metadata: Metadata = {
  title: 'کیف پول',
  robots: { index: false, follow: false },
};

export default function PortalWalletPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">کیف پول</h1>
      <p className="text-sm text-gray-500">مانده و گردش اعتبار حساب عمده. مصرف در تسویه تکی است.</p>
      <ShopperWalletBook />
    </div>
  );
}
