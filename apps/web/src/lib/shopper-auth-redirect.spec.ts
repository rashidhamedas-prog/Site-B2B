import assert from 'node:assert/strict';
import { shopperScopeFromLocation } from './admin-session';
import { resolveShopperLoginUrl } from './shopper-auth-redirect';

assert.equal(
  resolveShopperLoginUrl('/checkout', 'www.poshaktaranom.ir'),
  '/account?redirect=%2Fcheckout',
  'retail host checkout → account',
);
assert.equal(
  resolveShopperLoginUrl('/checkout', 'poshaktaranom.com'),
  '/portal/login?redirect=%2Fcheckout',
  'wholesale host checkout → portal login',
);
assert.equal(
  resolveShopperLoginUrl('/account', 'www.poshaktaranom.ir'),
  '/account?redirect=%2Faccount',
  'retail host account self-redirect',
);
assert.equal(
  resolveShopperLoginUrl('/portal/dashboard', 'poshaktaranom.com'),
  '/portal/login?redirect=%2Fportal%2Fdashboard',
  'wholesale portal dashboard',
);
assert.equal(
  shopperScopeFromLocation('/checkout', 'www.poshaktaranom.ir'),
  'retail',
  'shopperScopeFromLocation retail checkout',
);
assert.equal(
  shopperScopeFromLocation('/checkout', 'poshaktaranom.com'),
  'wholesale',
  'shopperScopeFromLocation wholesale checkout',
);

console.log('shopper-auth-redirect.spec.ts: OK');
