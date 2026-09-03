import { setToken } from './auth';

type PasswordSession = {
  accessToken?: string;
  role?: string;
  purpose?: string;
};

/** Keep the current tab signed in after password change/set/reset. */
export function applyPasswordSession(res: PasswordSession) {
  if (!res.accessToken) return;
  const scope = res.purpose === 'admin' ? 'admin' : 'storefront';
  setToken(res.accessToken, res.role || 'CUSTOMER', scope);
}