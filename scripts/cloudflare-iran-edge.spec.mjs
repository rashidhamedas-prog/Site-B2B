import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs, networkPatches, storefrontA, storefrontAAAA } from "./cloudflare-iran-edge.mjs";

test("parseArgs defaults to network dry-run", () => {
  const opts = parseArgs([]);
  assert.equal(opts.mode, "network");
  assert.equal(opts.dryRun, true);
  assert.equal(opts.apply, false);
});

test("parseArgs apply proxy", () => {
  const opts = parseArgs(["--mode=proxy", "--apply"]);
  assert.equal(opts.mode, "proxy");
  assert.equal(opts.apply, true);
  assert.equal(opts.dryRun, false);
  assert.equal(opts.confirmGray, false);
});

test("parseArgs refuses gray-cloud apply without an explicit rollback flag", () => {
  assert.throws(
    () => parseArgs(["--mode=origin", "--apply"]),
    /confirm-gray/,
  );
});

test("parseArgs allows gray-cloud only as a confirmed rollback", () => {
  const opts = parseArgs(["--mode=origin", "--apply", "--confirm-gray"]);
  assert.equal(opts.mode, "origin");
  assert.equal(opts.apply, true);
  assert.equal(opts.confirmGray, true);
});

test("parseArgs rejects unknown mode", () => {
  assert.throws(() => parseArgs(["--mode=arvan"]), /network\|proxy\|origin/);
});

test("networkPatches turn off ipv6 http3 and harsh browser checks", () => {
  const keys = Object.fromEntries(networkPatches().map((p) => [p.setting, p.value]));
  assert.equal(keys.ipv6, "off");
  assert.equal(keys.http3, "off");
  assert.equal(keys.security_level, "essentially_off");
  assert.equal(keys.browser_check, "off");
});

test("storefrontA matches apex www and api only", () => {
  assert.equal(storefrontA({ type: "A", name: "www.poshaktaranom.ir" }), true);
  assert.equal(storefrontA({ type: "A", name: "poshaktaranom.com" }), true);
  assert.equal(storefrontA({ type: "A", name: "api.poshaktaranom.com" }), true);
  assert.equal(storefrontA({ type: "A", name: "erp.poshaktaranom.com" }), false);
  assert.equal(storefrontA({ type: "AAAA", name: "poshaktaranom.com" }), false);
  assert.equal(storefrontAAAA({ type: "AAAA", name: "www.poshaktaranom.ir" }), true);
});
