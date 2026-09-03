import { cookieScopeFromPurpose } from './admin-session';
import { setToken } from './auth';

type PasswordSession = {
  accessToken?: string;
  role?: string;
  purpose?: string;
};

/** Keep the current tab signed in after password change/set/reset. */
export function applyPasswordSession(res: PasswordSession) {
  if (!res.accessToken) return;
  const scope = cookieScopeFromPurpose(res.purpose);
  setToken(res.accessToken, res.role || 'CUSTOMER', scope);
}