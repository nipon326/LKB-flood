#!/usr/bin/env node
// Run this from any machine on a normal residential/office network — BMA's
// site (weather.bangkok.go.th) blocks every cloud/hosting IP tested
// (Vercel, GitHub Actions, Cloudflare Workers) but allows ordinary
// connections. For each dashboard station this fetches its StationDetail
// page (current level + warning/critical thresholds + 2-day history all
// live there — BMA's old /water/Summary page used to carry current levels
// too, but a site restructuring stripped that down to bare station
// metadata, so StationDetail is now the only source for all of it) and
// publishes the result to this repo's `data` branch, which the live site
// reads via GitHub's raw-content CDN (not blocked, unlike BMA directly)
// and prefers when it's recent.
//
// Usage: node scripts/publish-snapshot.mjs
// (or: npm run publish-snapshot)

import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const STATION_IDS = [64, 39, 202, 201, 135, 131];
const REPO = "https://github.com/nipon326/LKB-flood.git";
const HEADERS = { "User-Agent": "Mozilla/5.0 (LKB-flood publisher)" };

// BMA's WAF has flip-flopped on whether a same-site Referer helps or hurts
// — try both, same as the (now largely blocked) Cloudflare relay did.
async function fetchBma(url) {
  const variants = [{}, { Referer: "https://weather.bangkok.go.th/water" }];
  let lastStatus;
  for (const extra of variants) {
    const res = await fetch(url, { headers: { ...HEADERS, ...extra } });
    if (res.ok) return res;
    lastStatus = res.status;
  }
  throw new Error(`BMA HTTP ${lastStatus} for ${url}`);
}

const POINT_RE =
  /\[Date\.UTC\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\),\s*(-?[\d.]+)\]/g;
const WARNING_RE = /id="txt_warning"[^>]*value="([^"]*)"/;
const CRITICAL_RE = /id="txt_critical"[^>]*value="([^"]*)"/;

async function fetchStation(id) {
  const res = await fetchBma(
    `https://weather.bangkok.go.th/water/StationDetail?id=${id}`
  );
  const html = await res.text();

  const points = [];
  for (const mm of html.matchAll(POINT_RE)) {
    const [, y, mo, d, h, mi, s, val] = mm;
    points.push({
      t: Date.UTC(+y, +mo, +d, +h, +mi, +s),
      level: parseFloat(val),
    });
  }
  points.sort((a, b) => a.t - b.t);

  const warningMatch = html.match(WARNING_RE);
  const criticalMatch = html.match(CRITICAL_RE);
  const last = points.at(-1) ?? null;

  return {
    level: last?.level ?? null,
    updatedAt: last?.t ?? null,
    warning: warningMatch ? parseFloat(warningMatch[1]) : null,
    critical: criticalMatch ? parseFloat(criticalMatch[1]) : null,
    history: points,
  };
}

async function main() {
  const stations = {};
  let okCount = 0;
  for (const id of STATION_IDS) {
    process.stdout.write(`Fetching station ${id}... `);
    try {
      const data = await fetchStation(id);
      stations[id] = data;
      okCount++;
      console.log(
        `level=${data.level} warning=${data.warning} critical=${data.critical} (${data.history.length} history points)`
      );
    } catch (err) {
      console.log(`failed (${err.message})`);
      stations[id] = { level: null, updatedAt: null, warning: null, critical: null, history: [] };
    }
  }
  if (okCount === 0) throw new Error("Every station failed — aborting publish");

  const snapshot = { fetchedAt: new Date().toISOString(), stations };

  const dir = mkdtempSync(join(tmpdir(), "lkb-data-"));
  console.log(`\nCloning data branch into ${dir}...`);
  execSync(`git clone --quiet --branch data --single-branch "${REPO}" "${dir}"`, {
    stdio: "inherit",
  });

  mkdirSync(join(dir, "data"), { recursive: true });
  writeFileSync(join(dir, "data", "snapshot.json"), JSON.stringify(snapshot));

  execSync(`git add data/snapshot.json`, { cwd: dir });
  const status = execSync(`git status --porcelain`, { cwd: dir }).toString();
  if (!status.trim()) {
    console.log("No changes since last publish — nothing to push.");
    return;
  }
  execSync(`git commit -q -m "Publish snapshot ${snapshot.fetchedAt}"`, { cwd: dir });
  execSync(`git push -q origin data`, { cwd: dir });
  console.log(`\nPublished snapshot at ${snapshot.fetchedAt} (${okCount}/${STATION_IDS.length} stations ok)`);
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
