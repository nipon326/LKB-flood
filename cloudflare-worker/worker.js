// LKB-flood relay worker.
//
// weather.bangkok.go.th blocks connections from Vercel, GitHub Actions, and
// (confirmed 2026-09-30) Cloudflare Workers too — it appears to blocklist
// hosting/cloud ASNs broadly, not one specific vendor. As of 2026-10 the app
// doesn't call this relay (RELAY_BASE_URL is unset) and instead relies on
// scripts/publish-snapshot.mjs, run manually from a residential network.
// This file is kept correct in case BMA's block ever eases for Workers
// specifically — re-enable by setting RELAY_BASE_URL to this Worker's URL.
//
// Deploy: paste this file's contents into a new Worker in the Cloudflare
// dashboard (Workers & Pages -> Create -> paste in the online editor),
// no build step or extra config needed. Routes:
//   GET /canal            -> current level for the two curated stations
//   GET /history?id=64    -> 2-day history for one station id

const STATION_IDS = [64, 39, 202, 201, 135, 131];

const USER_AGENT = "Mozilla/5.0 (LKB-flood dashboard relay)";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json; charset=utf-8",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// BMA's site is under heavy load from the flood event itself: about 1 in 5
// requests 403s even from a plain residential connection, seemingly at
// random rather than tied to any specific header (confirmed by testing
// repeated identical requests directly). It has also flip-flopped on
// whether a same-site Referer helps or hurts. So: try both header
// variants, and retry a few times, since a failure here is much more
// likely transient load-shedding than a deliberate block.
async function fetchBma(url) {
  const variants = [
    { "User-Agent": USER_AGENT },
    {
      "User-Agent": USER_AGENT,
      Referer: "https://weather.bangkok.go.th/water",
    },
  ];
  let lastStatus = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(400 * attempt);
    for (const headers of variants) {
      const res = await fetch(url, { headers });
      if (res.ok) return res;
      lastStatus = res.status;
    }
  }
  throw new Error(`BMA HTTP ${lastStatus} after retries`);
}

// BMA moved this page's content from /water/Summary to /water itself, and
// also stripped it down to bare station metadata (no live level or
// warning/critical anymore) — both current level and thresholds now only
// live on each station's own StationDetail page, alongside its history.
// scripts/publish-snapshot.mjs hit the same change; see its comments.
const POINT_RE =
  /\[Date\.UTC\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\),\s*(-?[\d.]+)\]/g;
const WARNING_RE = /id="txt_warning"[^>]*value="([^"]*)"/;
const CRITICAL_RE = /id="txt_critical"[^>]*value="([^"]*)"/;

function toBangkokString(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

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
  return {
    points,
    warning: warningMatch ? parseFloat(warningMatch[1]) : null,
    critical: criticalMatch ? parseFloat(criticalMatch[1]) : null,
  };
}

// Shaped to match what src/lib/canal.ts's fetchFromRelay() expects (the
// same shape the old /water/Summary allData used to have).
async function handleCanal() {
  const data = [];
  for (const id of STATION_IDS) {
    const { points, warning, critical } = await fetchStation(id);
    const last = points.at(-1);
    data.push({
      water_id: id,
      warning,
      critical,
      water_level_last: last
        ? { wl_in: last.level, site_timestamp: toBangkokString(last.t) }
        : null,
    });
  }
  return json({ ok: true, data, fetchedAt: new Date().toISOString() });
}

async function handleHistory(id) {
  if (!id) throw new Error("missing id query param");
  const { points } = await fetchStation(id);
  return json({ ok: true, points });
}

const relay = {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }
    try {
      if (url.pathname === "/canal") return await handleCanal();
      if (url.pathname === "/history")
        return await handleHistory(url.searchParams.get("id"));
      return json({ ok: true, message: "LKB-flood relay is running" });
    } catch (err) {
      return json({ ok: false, error: String(err && err.message ? err.message : err) }, 502);
    }
  },
};

export default relay;
