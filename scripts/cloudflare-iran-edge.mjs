#!/usr/bin/env node
/**
 * Iran-edge helper for poshaktaranom.ir / poshaktaranom.com.
 * Reads CLOUDFLARE_API_TOKEN only from the environment. Default is dry-run.
 *
 *   node scripts/cloudflare-iran-edge.mjs --mode network --dry-run
 *   node scripts/cloudflare-iran-edge.mjs --mode origin --apply
 */
const API = "https://api.cloudflare.com/client/v4";
const ZONE_NAMES = ["poshaktaranom.com", "poshaktaranom.ir"];

export function parseArgs(argv) {
  const out = { mode: "network", apply: false, dryRun: true };
  for (const arg of argv) {
    if (arg === "--apply") {
      out.apply = true;
      out.dryRun = false;
    } else if (arg === "--dry-run") {
      out.dryRun = true;
      out.apply = false;
    } else if (arg.startsWith("--mode=")) {
      out.mode = arg.slice("--mode=".length);
    }
  }
  if (out.mode !== "network" && out.mode !== "origin") {
    throw new Error(`mode must be network|origin, got ${out.mode}`);
  }
  return out;
}

export function networkPatches() {
  return [
    { setting: "ipv6", value: "off" },
    { setting: "http3", value: "off" },
    { setting: "security_level", value: "essentially_off" },
    { setting: "browser_check", value: "off" },
  ];
}

function storefrontHost(name) {
  const host = String(name || "").replace(/\.+$/, "");
  return (
    host === "poshaktaranom.com" ||
    host === "www.poshaktaranom.com" ||
    host === "api.poshaktaranom.com" ||
    host === "poshaktaranom.ir" ||
    host === "www.poshaktaranom.ir"
  );
}

function storefrontA(record) {
  if (record.type !== "A") return false;
  return storefrontHost(record.name);
}

function storefrontAAAA(record) {
  if (record.type !== "AAAA") return false;
  return storefrontHost(record.name);
}

async function cf(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(`${method} ${path} failed: ${JSON.stringify(json.errors || json)}`);
  }
  return json.result;
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const opts = parseArgs(argv);
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    console.error("CLOUDFLARE_API_TOKEN is missing. Dry docs only; no live change.");
    process.exitCode = 2;
    return { ok: false, reason: "missing_token", opts };
  }

  const planned = { opts, zones: [] };
  for (const name of ZONE_NAMES) {
    const zones = await cf(token, "GET", `/zones?name=${encodeURIComponent(name)}`);
    const zone = Array.isArray(zones) ? zones[0] : null;
    if (!zone) throw new Error(`zone not found: ${name}`);
    const aRecords = await cf(token, "GET", `/zones/${zone.id}/dns_records?type=A&per_page=100`);
    const aaaaRecords = await cf(token, "GET", `/zones/${zone.id}/dns_records?type=AAAA&per_page=100`);
    const storefront = (Array.isArray(aRecords) ? aRecords : []).filter(storefrontA);
    const storefront6 = (Array.isArray(aaaaRecords) ? aaaaRecords : []).filter(storefrontAAAA);
    planned.zones.push({
      name,
      id: zone.id,
      settings: networkPatches(),
      grayCloud:
        opts.mode === "origin" ? storefront.map((r) => ({ id: r.id, name: r.name, type: "A", proxied: r.proxied })) : [],
      deleteAaaa:
        opts.mode === "origin" ? storefront6.map((r) => ({ id: r.id, name: r.name, type: "AAAA" })) : [],
    });
  }

  console.log(JSON.stringify(planned, null, 2));
  if (opts.dryRun || !opts.apply) {
    console.log("dry-run: no Cloudflare writes");
    return { ok: true, planned };
  }

  for (const zone of planned.zones) {
    for (const patch of zone.settings) {
      await cf(token, "PATCH", `/zones/${zone.id}/settings/${patch.setting}`, { value: patch.value });
      console.log(`patched ${zone.name} ${patch.setting}=${patch.value}`);
    }
    try {
      await cf(token, "PUT", `/zones/${zone.id}/bot_management`, { fight_mode: false });
      console.log(`patched ${zone.name} bot_management.fight_mode=false`);
    } catch (err) {
      console.warn(`bot_management skipped on ${zone.name}: ${err.message}`);
    }
    for (const rec of zone.grayCloud) {
      await cf(token, "PATCH", `/zones/${zone.id}/dns_records/${rec.id}`, { proxied: false });
      console.log(`gray-cloud ${zone.name} ${rec.name}`);
    }
    for (const rec of zone.deleteAaaa || []) {
      await cf(token, "DELETE", `/zones/${zone.id}/dns_records/${rec.id}`);
      console.log(`deleted AAAA ${zone.name} ${rec.name}`);
    }
  }
  return { ok: true, planned, applied: true };
}

const launchedDirectly = process.argv[1] && process.argv[1].endsWith("cloudflare-iran-edge.mjs");
if (launchedDirectly && !process.argv.includes("--test-export")) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  });
}

export { main, storefrontA, storefrontAAAA, storefrontHost };
