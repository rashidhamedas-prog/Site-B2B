'use client';

import { ShopperWalletBook } from '@/components/admin/AdminCustomerWallet';

export default function RetailWalletPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">کیف پول</h1>
      <ShopperWalletBook />
    </div>
  );
}
