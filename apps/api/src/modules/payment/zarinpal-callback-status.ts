/** ZarinPal return-URL Status is OK / NOK; treat missing as OK (authority still verified server-side). */
export function zarinpalCallbackIsSuccess(status?: string): boolean {
  const s = String(status ?? 'OK').trim().toUpperCase();
  return s === '' || s === 'OK';
}
