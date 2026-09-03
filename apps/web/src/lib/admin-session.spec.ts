import assert from 'node:assert/strict';
import {
  ADMIN_ROLE_KEY,
  ADMIN_TOKEN_KEY,
  STOREFRONT_ROLE_KEY,
  STOREFRONT_TOKEN_KEY,
  WHOLESALE_TOKEN_KEY,
  canEnterAdmin,
  cookieScopeFromPurpose,
  isAdminAuthFailureMessage,
  isAdminPurposeToken,
  readAdminGateCookies,
  readJwtPurpose,
  readPortalGateCookies,
  shopperScopeFromLocation,
} from './admin-session';

function cookieBag(map: Record<string, string>) {
  return {
    get(name: string) {
      const value = map[name];
      return value ? { value } : undefined;
    },
  };
}

function jwtWith(payload: Record<string, unknown>): string {
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `eyJhbGciOiJub25lIn0.${json}.x`;
}

const shopperOnly = readAdminGateCookies(
  cookieBag({
    [STOREFRONT_TOKEN_KEY]: 'shopper-jwt',
    [STOREFRONT_ROLE_KEY]: 'ADMIN',
  }),
);
assert.equal(shopperOnly.token, undefined, 'shopper token must not open admin');
assert.equal(shopperOnly.role, undefined, 'shopper role cookie must not open admin');

const staff = readAdminGateCookies(
  cookieBag({
    [ADMIN_TOKEN_KEY]: 'admin-jwt',
    [ADMIN_ROLE_KEY]: 'ADMIN',
    [STOREFRONT_TOKEN_KEY]: 'shopper-jwt',
    [STOREFRONT_ROLE_KEY]: 'CUSTOMER',
  }),
);
assert.equal(staff.token, 'admin-jwt');
assert.equal(staff.role, 'ADMIN');

assert.equal(isAdminAuthFailureMessage('فقط مدیر کل دسترسی دارد'), true);
assert.equal(isAdminAuthFailureMessage('دسترسی غیرمجاز'), true);
assert.equal(isAdminAuthFailureMessage('خطای سرور'), false);

const shopperJwt = jwtWith({ purpose: 'storefront', role: 'CUSTOMER' });
const adminJwt = jwtWith({ purpose: 'admin', role: 'ADMIN' });
const legacyAdminJwt = jwtWith({ role: 'ADMIN' });

assert.equal(readJwtPurpose(shopperJwt), 'storefront');
assert.equal(readJwtPurpose(adminJwt), 'admin');
assert.equal(readJwtPurpose(legacyAdminJwt), undefined);
assert.equal(isAdminPurposeToken(shopperJwt), false);
assert.equal(isAdminPurposeToken(adminJwt), true);
assert.equal(isAdminPurposeToken(legacyAdminJwt), false, 'legacy tokens must re-login');

assert.equal(canEnterAdmin(adminJwt, 'ADMIN'), true);
assert.equal(canEnterAdmin(adminJwt, 'SALES_MANAGER'), true);
assert.equal(canEnterAdmin(adminJwt, null), true, 'JWT role is enough');
assert.equal(canEnterAdmin(shopperJwt, 'ADMIN'), false, 'cookie ADMIN cannot launder shopper JWT');
assert.equal(canEnterAdmin(legacyAdminJwt, 'ADMIN'), false);
assert.equal(canEnterAdmin(adminJwt, 'CUSTOMER'), true, 'admin JWT wins over stale cookie role');

assert.equal(cookieScopeFromPurpose('admin'), 'admin');
assert.equal(cookieScopeFromPurpose('retail'), 'retail');
assert.equal(cookieScopeFromPurpose('portal'), 'wholesale');
assert.equal(cookieScopeFromPurpose('storefront'), 'wholesale');
assert.equal(shopperScopeFromLocation('/portal/dashboard', 'localhost'), 'wholesale');
assert.equal(shopperScopeFromLocation('/account', 'localhost'), 'retail');
assert.equal(shopperScopeFromLocation('/retail/checkout', 'localhost'), 'retail');
assert.equal(shopperScopeFromLocation('/checkout', 'www.poshaktaranom.ir'), 'retail');
assert.equal(shopperScopeFromLocation('/checkout', 'poshaktaranom.com'), 'wholesale');

const portalCookies = readPortalGateCookies(
  cookieBag({
    [WHOLESALE_TOKEN_KEY]: 'wholesale-jwt',
    [STOREFRONT_TOKEN_KEY]: 'legacy-jwt',
  }),
);
assert.equal(portalCookies.token, 'wholesale-jwt', 'dedicated wholesale cookie wins');

const legacyPortal = readPortalGateCookies(
  cookieBag({
    [STOREFRONT_TOKEN_KEY]: 'legacy-jwt',
  }),
);
assert.equal(legacyPortal.token, 'legacy-jwt', 'legacy shopper cookie still opens portal');

console.log('admin-session.spec.ts ok');
