import {
  WHOLESALE_CANONICAL_ORIGIN,
  isLocalDevHost,
  isPortalPath,
  isRetailAccountPath,
  panelHostLockRedirect,
  publicAccountPath,
} from './panel-host-lock';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isPortalPath('/portal') === true, 'portal root');
assert(isPortalPath('/portal/login') === true, 'portal login');
assert(isPortalPath('/account') === false, 'account is not portal');
assert(isRetailAccountPath('/account/orders') === true, 'account nested');
assert(isRetailAccountPath('/retail/account') === true, 'internal account');
assert(isRetailAccountPath('/retail/products') === false, 'retail catalog stays');
assert(publicAccountPath('/retail/account/orders') === '/account/orders', 'strip retail prefix');
assert(isLocalDevHost('localhost:3000') === true, 'localhost');
assert(isLocalDevHost('localhost.ir') === true, 'localhost.ir');
assert(isLocalDevHost('www.poshaktaranom.ir') === false, 'prod ir');

const irPortal = panelHostLockRedirect({
  host: 'www.poshaktaranom.ir',
  pathname: '/portal/login',
  search: '?redirect=%2Fportal%2Fdashboard',
});
assert(irPortal?.origin === WHOLESALE_CANONICAL_ORIGIN, 'ir portal → .com');
assert(irPortal?.pathname === '/portal/login', 'keep portal path');

const comAccount = panelHostLockRedirect({
  host: 'poshaktaranom.com',
  pathname: '/retail/account/orders',
});
assert(comAccount?.origin === WHOLESALE_CANONICAL_ORIGIN, 'com account stays on .com');
assert(comAccount?.pathname === '/portal/login', 'wholesale account → portal login');
assert(
  comAccount?.search === '?redirect=%2Fportal%2Fdashboard',
  'account path falls back to portal dashboard redirect',
);

const comAccountRoot = panelHostLockRedirect({
  host: 'poshaktaranom.com',
  pathname: '/account',
});
assert(comAccountRoot?.origin === WHOLESALE_CANONICAL_ORIGIN, 'com /account stays on .com');
assert(comAccountRoot?.pathname === '/portal/login', 'com /account → portal login');

assert(
  panelHostLockRedirect({ host: 'localhost:3000', pathname: '/portal/login' }) === null,
  'local portal stays',
);
assert(
  panelHostLockRedirect({ host: 'www.poshaktaranom.ir', pathname: '/account' }) === null,
  'ir account stays',
);
assert(
  panelHostLockRedirect({ host: 'poshaktaranom.com', pathname: '/portal/dashboard' }) === null,
  'com portal stays',
);

console.log('panel-host-lock.spec.ts: OK');
