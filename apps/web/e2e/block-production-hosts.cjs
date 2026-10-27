/**
 * Loaded via NODE_OPTIONS=--require before the Next standalone server.
 * Any DNS lookup or fetch aimed at poshaktaranom.com / .ir throws, so a
 * missed mock cannot silently read the live catalog.
 */
'use strict';

const dns = require('dns');
const http = require('http');
const https = require('https');

const BLOCKED = /(^|\.)poshaktaranom\.(com|ir)$/i;
const MARK = Symbol.for('taranom.e2e.blockProduction');

function hostnameOf(input) {
  if (!input) return '';
  if (typeof input === 'string') {
    try {
      if (input.includes('://')) return new URL(input).hostname;
    } catch {
      /* not a URL */
    }
    return input.split(':')[0];
  }
  if (input instanceof URL) return input.hostname;
  if (typeof input === 'object') {
    if (typeof input.hostname === 'string' && input.hostname) return input.hostname;
    if (typeof input.host === 'string' && input.host) return input.host.split(':')[0];
    if (typeof input.href === 'string') return hostnameOf(input.href);
    if (typeof input.url === 'string') return hostnameOf(input.url);
  }
  return '';
}

function rejectProduction(input) {
  const host = hostnameOf(input);
  if (!host || !BLOCKED.test(host)) return;
  const error = new Error(`E2E blocked production request to ${host}`);
  error.code = 'E2E_PRODUCTION_BLOCKED';
  throw error;
}

function wrapLookup(fn) {
  if (!fn || fn[MARK]) return fn;
  function wrapped(hostname, options, callback) {
    try {
      rejectProduction(hostname);
    } catch (error) {
      if (typeof options === 'function') return options(error);
      if (typeof callback === 'function') return callback(error);
      throw error;
    }
    return fn.call(this, hostname, options, callback);
  }
  wrapped[MARK] = true;
  return wrapped;
}

dns.lookup = wrapLookup(dns.lookup);
if (dns.promises && typeof dns.promises.lookup === 'function') {
  const orig = dns.promises.lookup.bind(dns.promises);
  dns.promises.lookup = function lookup(hostname, options) {
    rejectProduction(hostname);
    return orig(hostname, options);
  };
  dns.promises.lookup[MARK] = true;
}

function wrapRequest(mod, name) {
  const orig = mod[name];
  if (typeof orig !== 'function' || orig[MARK]) return;
  function wrapped(options, ...rest) {
    rejectProduction(options);
    if (options && typeof options === 'object') {
      rejectProduction(options.hostname || options.host || options.href);
    }
    return orig.call(this, options, ...rest);
  }
  wrapped[MARK] = true;
  mod[name] = wrapped;
}

wrapRequest(http, 'request');
wrapRequest(http, 'get');
wrapRequest(https, 'request');
wrapRequest(https, 'get');

if (typeof globalThis.fetch === 'function' && !globalThis.fetch[MARK]) {
  const origFetch = globalThis.fetch;
  function wrappedFetch(input, init) {
    rejectProduction(typeof input === 'string' ? input : input && input.url ? input.url : input);
    return origFetch.call(this, input, init);
  }
  wrappedFetch[MARK] = true;
  globalThis.fetch = wrappedFetch;
}
