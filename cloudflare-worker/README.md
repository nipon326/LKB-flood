# LKB-flood relay (Cloudflare Worker)

BMA's site (weather.bangkok.go.th) blocks connections from Vercel and
GitHub Actions. This Worker is a test-and-relay: if Cloudflare's network
isn't blocked either, it lets the dashboard get real BMA data again.

## Deploy (dashboard, no CLI needed)

1. Go to https://dash.cloudflare.com/ and sign up (free plan, no credit
   card needed for Workers).
2. In the sidebar: **Workers & Pages** → **Create** → **Create Worker**.
3. Give it any name (e.g. `lkb-flood-relay`) → **Deploy** (deploys the
   default "Hello World" template first, that's fine).
4. Click **Edit code** (opens the online editor).
5. Delete everything in the editor and paste in the full contents of
   [`worker.js`](./worker.js) from this folder.
6. Click **Deploy** (top right).
7. Copy the Worker's URL — shown at the top of the editor / on the Worker's
   overview page, looks like `https://lkb-flood-relay.<your-subdomain>.workers.dev`.

## Verify it actually works

Open these two URLs in a browser (replace with your real Worker URL):

- `https://lkb-flood-relay.<sub>.workers.dev/canal` — should return JSON
  with `"ok":true` and current water levels for stations 64 and 39.
- `https://lkb-flood-relay.<sub>.workers.dev/history?id=64` — should
  return JSON with `"ok":true` and a `points` array.

If instead you get `"ok":false"` with a timeout/network error, Cloudflare
is blocked the same way Vercel and GitHub were, and this approach won't
work — report back so we can switch to a relay on an unblocked network.

## Wire it into the dashboard

Send the Worker URL back — the app needs a `RELAY_BASE_URL` environment
variable (in `.env.local` for dev, and in the Vercel project's
Environment Variables for production) set to that URL, e.g.:

```
RELAY_BASE_URL=https://lkb-flood-relay.<your-subdomain>.workers.dev
```
