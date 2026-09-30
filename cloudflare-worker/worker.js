// LKB-flood relay worker.
//
// weather.bangkok.go.th blocks connections from Vercel and GitHub Actions
// (both confirmed by direct testing), so this Worker sits between our
// deployed dashboard and BMA's site, scraping the same live HTML our
// original code did. If Cloudflare's egress IPs aren't on BMA's blocklist
// either, this restores real-time data; if they are, every route below
// will fail the same way the direct calls did, and that's the signal to
// fall back to running the relay from an unblocked network instead (e.g.
// a home machine) rather than a cloud platform.
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
      Referer: "https://weather.bangkok.go.th/water/Summary",
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

async function handleCanal() {
  const res = await fetchBma("https://weather.bangkok.go.th/water/Summary");
  const html = await res.text();
  const m = html.match(/const allData = (\[[\s\S]*?\]);/);
  if (!m) throw new Error("allData not found in Summary page");
  const data = JSON.parse(m[1]);
  const filtered = data.filter((d) => STATION_IDS.includes(d.water_id));
  return json({ ok: true, data: filtered, fetchedAt: new Date().toISOString() });
}

const POINT_RE =
  /\[Date\.UTC\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\),\s*(-?[\d.]+)\]/g;

async function handleHistory(id) {
  if (!id) throw new Error("missing id query param");
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
