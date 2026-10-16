# Hyderabad Tycoon

A Hyderabad-themed Monopoly-style business game: React 19 + Vite on the front, one Cloudflare Worker (Hono) with Durable Objects for real-time rooms, Neon Postgres for accounts / friends / match history, Google Sign-In.

```
Browser ──HTTPS──► Cloudflare Worker (worker/index.js, Hono)
   │                 ├─ /api/*   JSON API, cookie session (JWT)      ──► Neon Postgres (HTTP driver)
   │                 ├─ /ws/room/:code ─► GameRoom Durable Object (one per room: lobby + server-authoritative game)
   │                 ├─ /ws/user       ─► UserHub  Durable Object (one per user: friend requests, invites, presence)
   └─WebSocket──────►└─ everything else ─► static assets (dist/, SPA fallback)
```

* **Rules engine** (`shared/`) is pure JS and runs in the browser (offline play, bots) *and* inside the `GameRoom` Durable Object (online play). The server is authoritative: clients send intents, the room forces `playerId`, validates through the engine, then broadcasts `{state, events, seq}`.
* **GameRoom** uses the WebSocket Hibernation API and keeps the whole room in Durable Object storage, so eviction/restarts are safe. Bots, idle humans and disconnected humans are driven by alarms.
* **Neon** is only touched for accounts, friendships, the leaderboard and finished matches. A match is written exactly once (deterministic match id + `ON CONFLICT DO NOTHING` in a single atomic statement).

## Requirements

Node 24+, npm, a free Cloudflare account, a free [Neon](https://neon.tech) database, a Google Cloud project (for Sign-In).

## Local development

```bash
npm install

# 1. secrets for local dev (git-ignored). NEVER commit this file.
cat > .dev.vars <<'EOF'
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
JWT_SECRET=<long random string, e.g. output of: openssl rand -base64 48>
GOOGLE_CLIENT_ID=<your OAuth web client id>.apps.googleusercontent.com
EOF

# 2. create the tables (idempotent, safe to repeat)
npm run migrate            # = node scripts/migrate.js

# 3. run the Worker (API + WebSockets + Durable Objects) on :8787
npm run build              # once: wrangler serves the built app from dist/ (not needed for API-only work)
npm run worker             # = npx wrangler dev --port 8787

# 4. in a second terminal: the Vite dev server on :5173 (proxies /api and /ws to :8787)
npm run dev
```

Open <http://localhost:5173>. `npm run worker` alone also serves the production build on <http://localhost:8787>.

Without `GOOGLE_CLIENT_ID` the Google button is hidden (`/api/config` returns `googleClientId: null`); "Play as guest" always works. Guests can play rooms but cannot use friends or the leaderboard.

Tests: `npm test` (Vitest: engine, client helpers and the Worker: validation, JWT/cookies/Google-token verification, rate limiting, security headers, and full in-process runs of the `GameRoom` Durable Object with a fake runtime).

### Google OAuth setup

1. [Google Cloud Console](https://console.cloud.google.com/) → create/select a project.
2. **APIs & Services → OAuth consent screen**: user type *External*, app name, support email, developer email. Publish it (or add yourself as a test user while testing).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
4. **Authorized JavaScript origins** (exact origins, no paths, no trailing slash):
   * `http://localhost:5173` (Vite dev)
   * `http://localhost:8787` (Worker dev)
   * your production origin, e.g. `https://hyderabad-tycoon.<your-subdomain>.workers.dev` and/or your custom domain
5. No redirect URIs are needed (the app uses the Google Identity Services button + ID-token callback).
6. Copy the **Client ID** into `.dev.vars` as `GOOGLE_CLIENT_ID` (and into the production secret, below). The client *secret* is not used.

Changes to authorized origins can take a few minutes to apply.

## Configuration reference

| Name | Where | Secret? | Purpose |
|---|---|---|---|
| `DATABASE_URL` | `.dev.vars` / `wrangler secret` | yes | Neon connection string |
| `JWT_SECRET` | `.dev.vars` / `wrangler secret` | yes | HS256 key for the `hyd_session` cookie (≥ 16 chars; use 48+ random bytes) |
| `GOOGLE_CLIENT_ID` | `.dev.vars` / `wrangler secret` | no (public id) | audience check for Google ID tokens; also sent to the browser by `/api/config` |
| `APP_NAME` | `wrangler.toml [vars]` | no | display name returned by `/api/config` |

## Deploying to Cloudflare (first time)

Prerequisites: Cloudflare account, Neon database, a Google OAuth web client (see above). Run from the repo root.

```bash
# 1. log in to Cloudflare (opens a browser)
npx wrangler login

# 2. set the production secrets (each command prompts for the value; nothing is stored in git)
npx wrangler secret put DATABASE_URL
npx wrangler secret put JWT_SECRET            # openssl rand -base64 48
npx wrangler secret put GOOGLE_CLIENT_ID

# 3. create the tables in the production Neon database (idempotent)
DATABASE_URL='postgresql://…' npm run migrate   # or put it in .dev.vars and run: npm run migrate

# 4. build the web app and deploy the Worker + Durable Objects + assets
npm run deploy                                  # = npm run build && wrangler deploy
```

The first `wrangler deploy` creates the Worker `hyderabad-tycoon`, applies the Durable Object migration (`v1`: `GameRoom`, `UserHub`, SQLite-backed) and prints the URL, `https://hyderabad-tycoon.<your-subdomain>.workers.dev`.

5. **Add that URL (and any custom domain) to the Google OAuth client's *Authorized JavaScript origins*** (Credentials → your Web client). Without it the Google button shows an origin error. For a custom domain, add a `[[routes]]` block to `wrangler.toml` (`pattern = "play.example.com"`, `custom_domain = true`) and redeploy.
6. **Verify**: `curl https://<your-worker-url>/api/health` → `{"ok":true,"time":"…","db":true}`. `db:false` means the Worker cannot reach Neon (check `DATABASE_URL`). Then open the site, play as guest, create a room.
7. **Logs**: `npx wrangler tail` (live) or Cloudflare dashboard → Workers → hyderabad-tycoon → Logs (observability is enabled).
8. **Rollback**: `npx wrangler deployments list`, then `npx wrangler rollback [version-id]`. Database changes are additive/idempotent, so rolling the code back is safe.

Dry run without logging in (bundles, checks config, uploads nothing): `npm run build && npx wrangler deploy --dry-run --outdir /tmp/out`.

### Continuous deployment (GitHub Actions)

`.github/workflows/deploy.yml` runs on every push to `main`: install → `npm test` → `npm run build` → `node scripts/migrate.js` → `wrangler deploy` (via `cloudflare/wrangler-action`). `.github/workflows/migrate.yml` is a manual (*Run workflow*) migrations-only job.

Create these **repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create Token → template **Edit Cloudflare Workers** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID (right sidebar) |
| `DATABASE_URL` | the production Neon connection string (only used for the migration step) |

The Worker's runtime secrets (`DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`) are set once in Cloudflare with `wrangler secret put`; the workflows do not touch them. Do the manual first deploy (above) before enabling the workflow, or at least run the three `secret put` commands first.

## API summary

All JSON, same-origin, cookie session `hyd_session` (`HttpOnly; SameSite=Lax; Path=/; Secure` on https; 30 days). Errors are `{ "error": "message" }` with a proper status (400 invalid input, 401 not signed in, 403 forbidden / guest, 404, 413 body > 16 KB, 429 rate limited).

| Endpoint | Notes |
|---|---|
| `GET /api/health` | `{ ok, time, db }` (db = `select 1` with a 2.5 s timeout). Public. |
| `GET /api/config` | `{ googleClientId \| null, appName }` |
| `POST /api/auth/google {credential}` | verifies the Google ID token (signature via Google JWKS, `aud`, `iss`, `exp`, `email_verified`), upserts the user, sets the cookie → `{ user }` |
| `POST /api/auth/guest {name?, avatar?}` | creates a guest user (`isGuest: true`) → `{ user }` |
| `POST /api/auth/logout` | clears the cookie |
| `GET /api/me` / `PATCH /api/me {name?, avatar?}` | `{ user \| null }`; name ≤ 24 chars, avatar 0–11 |
| `GET /api/friends` | `{ friends:[{id,name,avatar,friendCode,online,level}], incoming, outgoing }` (members only) |
| `POST /api/friends/request {friendCode}` | idempotent; a mutual request auto-accepts → `{ ok, status:'pending'\|'accepted', friend }` |
| `POST /api/friends/accept {userId}` · `POST /api/friends/decline {userId}` · `DELETE /api/friends/:userId` | `DELETE` unfriends or cancels an outgoing request |
| `POST /api/rooms {settings?, maxPlayers?}` | → `{ code }` (201). Invalid settings → 400 with a message |
| `GET /api/rooms/:code` | `{ code, exists, status:'lobby'\|'playing'\|'finished', players (count), maxPlayers, hostName, isMember }` |
| `POST /api/invites {code, userId}` | friend + room-member checks; pushes `invite` to that friend's `UserHub` |
| `GET /api/leaderboard` | `{ rows:[{rank,name,avatar,level,wins,games,bestWorth}] }` (members only, top 50, cached 15 s) |

Friend codes are `HYD-XXXX` and room codes 6 characters, both from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.

### Room settings (validated server-side, in the route *and* again in the room)

| Setting | Accepted | Default |
|---|---|---|
| `goal` | integer 10,000 – 1,000,000 | 70,000 |
| `startCash` | integer 5,000 – 100,000 | 15,000 |
| `maxRounds` | exactly `30`, `50` or `null` (unlimited) | 50 |
| `dice` | `'lucky'` or `'fair'` | `'lucky'` |
| `auctionOnDecline` | boolean | `true` |
| `maxPlayers` | integer 2 – 6 (also accepted inside `settings`) | 4 |

Anything else (strings, floats, `Infinity`, `0`, unknown keys such as `debug`/`seed`) is rejected or ignored. Only the host may change settings, and only while the room is in the lobby. The normalised values appear in `room.settings` and are passed to `createGame`, so `state.cfg` matches.

## WebSocket protocol

`GET /ws/room/:code` and `GET /ws/user` upgrade only with a valid session cookie and a same-origin `Origin`. The Worker then forwards to the Durable Object with trusted headers (`X-User-Id`, `X-User-Name` (percent-encoded), `X-User-Avatar`, `X-User-Guest`) that clients can never set themselves. Failures are delivered as an application close code so the client can stop retrying: `4001` not signed in, `4003` full / already started / removed, `4004` no such room.

Client → room: `{t:'ready',ready}` `{t:'settings',settings}` (host, lobby) `{t:'addBot'}` `{t:'removeBot',id}` `{t:'kick',id}` (host, lobby) `{t:'start'}` (host, ≥ 2 players) `{t:'action',action}` `{t:'chat',text?,emote?}` `{t:'leave'}` `{t:'ping'}`.

Room → client: `{t:'room',room:{code,status,hostId,maxPlayers,settings,players:[{id,name,avatar,ready,connected,isBot}]}}` · `{t:'state',state,events,seq}` (on connect/reconnect: current state with `events: []`) · `{t:'chat',id,from,text,emote}` · `{t:'error',message}` · `{t:'pong'}` · `{t:'kicked'}`.

`action` accepts every action in the contract (`ROLL PAY_BAIL BUY SKIP_BUY UPGRADE END_TURN BID RESIGN MORTGAGE UNMORTGAGE SELL_BUILDING PAY_DEBT USE_JAIL_CARD TRADE_OFFER TRADE_ACCEPT TRADE_REJECT TRADE_CANCEL`); shapes are checked, `playerId` is forced to the socket's user, and legality is decided by the engine.

Sealed bids: while an auction is pending, every `state` message (including the connect/reconnect snapshot) is masked per recipient, so `pending.bids` shows your own amount and `0` for everyone else (the key stays, so "has bid" is visible). The `auction_end` event reveals all bids. In the debt phase the debtor (`state.debt.player`) may mortgage, sell, pay or resign even when it is not their turn.

Timers (server side): bots move every ~900 ms (~400 ms for auction bids, plus the client animation time of the previous move); a human has 45 s per decision (including the debt phase), then is auto-played and stays on fast auto-play until they act; a disconnected human is auto-played after a 15 s grace; a pending trade offer is auto-rejected after 30 s; a lobby member who vanishes is dropped after 60 s; a game nobody is connected to for 5 minutes is abandoned (not recorded); rooms expire 24 h after the last activity.

`/ws/user` pushes `{t:'friend_request',from}` `{t:'friend_accepted',by}` `{t:'invite',from,code}` `{t:'presence',userId,online}`.

## Database

`db/schema.sql` (idempotent, additive only): `users`, `friendships` (one row per pair, enforced by a unique index on `(LEAST, GREATEST)`), `matches` (`rounds`, `goal`, `max_rounds` (NULL = unlimited), `dice_mode`, `win_reason` incl. `'rounds'`), `match_players` (`hotels_built`, ranks, final worth). `node scripts/migrate.js` applies it statement by statement (it refuses anything that is not `CREATE … IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`) and prints only table names and row counts.

## Security notes

* **Rotate any credential that has ever been pasted into a chat, ticket or commit** (Neon password, `JWT_SECRET`, API tokens). Changing `JWT_SECRET` signs everyone out; rotate the Neon password in the Neon console and update `DATABASE_URL` everywhere (`.dev.vars`, `wrangler secret put`, the GitHub secret). Never commit `.dev.vars`.
* Cookie session: `HttpOnly`, `SameSite=Lax`, `Secure` over https. State-changing requests and WebSocket upgrades from a foreign `Origin` are refused.
* Every input is validated (names ≤ 24 chars with control/invisible characters stripped, avatar 0–11, codes from the unambiguous alphabet, chat ≤ 200 chars, settings as above, every WebSocket message shape and size); SQL is parameterised only; request bodies over 16 KB are rejected while streaming.
* Light in-memory rate limits (per isolate) on auth, room creation, friend requests, invites, profile edits and room lookups; WebSocket messages are rate limited per user and chat to one message per 700 ms.
* Security headers: API via middleware (`worker/security.js`), static files via `public/_headers` (CSP allowing only the app itself plus Google Identity Services, `frame-ancestors 'none'`, HSTS, `nosniff`, referrer and permissions policies; hashed assets are `immutable`, `index.html` is `no-cache`).
