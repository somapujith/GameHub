# GameHub: Hyderabad Tycoon

GameHub is a small online games marketplace; **Hyderabad Tycoon** is its first (and so far only live) game: a Monopoly-style
property game on a 40-square Hyderabad board, for 2-6 friends, played in a private room. React 19 + Vite on the front, one Cloudflare Worker
(Hono) with Durable Objects for real-time rooms, Neon Postgres for accounts / friends / match history, Google Sign-In or guest play.

**The product in one breath:** pick the game, choose how many players, create a table, share the code, wait for friends in the lobby, set the end cash limit, start.
Humans only: **no bots, no voice lines, no story or campaign, no offline play, English only.**

```
Browser ──HTTPS──► Cloudflare Worker (worker/index.js, Hono)
   │                 ├─ /api/*   JSON API, cookie session (JWT)      ──► Neon Postgres (HTTP driver)
   │                 ├─ /ws/room/:code ─► GameRoom Durable Object (one per room: lobby + server-authoritative game)
   │                 ├─ /ws/user       ─► UserHub  Durable Object (one per user: friend requests, invites, presence)
   └─WebSocket──────►└─ everything else ─► static assets (dist/, SPA fallback)
```

* **Rules engine** (`shared/`) is pure JS shared by the browser (board data, derived views, the client's own `getOptions`) and the `GameRoom` Durable Object. The server is authoritative: clients send intents, the room forces `playerId`, validates through the game's **adapter**, then broadcasts `{state, events, seq}`.
* **Game adapters** (`worker/games/<id>.js`, registry `worker/games/index.js`) are the only server code that knows a game's rules: settings validation, game creation, idle/disconnect auto-play, game timers, secret hiding, results. `GameRoom` is game-agnostic and picks the adapter from the room's `gameId`. See [Adding a game](#adding-a-game-server-side).
* **GameRoom** uses the WebSocket Hibernation API and keeps the whole room in Durable Object storage, so eviction/restarts are safe. Idle and disconnected players are played on their behalf by alarms (every seat is a real player; there are no bots).
* **Neon** is only touched for accounts, friendships, the leaderboard, finished matches, per-game stats and the room listing. A match is written exactly once (deterministic match id + `ON CONFLICT DO NOTHING` in a single atomic statement).

## How a game starts (player flow)

1. **Game page** `/games/:gameId`: one quick-start card with the game's name and tagline.
2. **Players**: "How many players?" (buttons from the game's `players.min` to `players.max`, 4 preselected).
3. **Table**: **Create table** opens a *private* room with that many seats and the default settings (`POST /api/rooms {gameId, maxPlayers, visibility:'private', settings}`) and goes to the lobby. Guests and Google users can both host. "Join with a code" is a small link under it (the top bar's "Have a code?" does the same).
4. **Lobby** `/lobby/:code`: room code, copy-link / WhatsApp / QR to invite (signed-in players can also invite friends in one tap), and the seat grid ("2 of 4 joined"; the host can remove players; removed players are barred for 10 minutes). The host sets the **end cash limit** (quick picks plus a stepper, default ₹70,000); everyone else sees "First to reach ₹70,000 wins". Rounds, dice, start cash and the auction rule keep their defaults and are not shown. No ready toggle.
5. **Start**: the host's button needs at least 2 players ("Start with 3 players", "Table full - start!"). Everyone else sees "Waiting for the host to start..." and is taken to the board (`/play/:gameId/online/:code`) when the room status becomes `playing`.
6. **Game over**: podium and stats; "New room, same settings" creates a fresh private room (a game cannot restart in the same room).

Other screens: `/` Home (hero, friends, browse by category, top players, daily reward) · `/join[/:code]` · `/friends`, `/f/:code` · `/leaderboard` · `/profile` · `/login`. Old links to the retired bots / open tables / story / campaign screens (`/play`, `/campaign`, `/story`, `/games/:id/play|tables|x/*`, `/play/:id/offline`) redirect to the game page.
Without `GOOGLE_CLIENT_ID` the Google button is hidden (`/api/config` returns `googleClientId: null`); "Play as guest" always works. Guests can host, join and play rooms and read the leaderboard, but cannot use friends, get invites or appear in the rankings.

## Hyderabad Tycoon in 60 seconds

* **One die.** Everyone starts with ₹15,000 at the airport (START) and walks clockwise around 40 squares. Roll one die; **a six rolls again**. Passing or landing on START pays ₹2,000. Dice are *lucky* by default (a small, disclosed help for whoever is behind) or *fair*.
* **Buy, build, collect.** Buy a free property, station or utility; skip it and a sealed-bid auction opens. A full colour set doubles base rent and lets you build (Kirana, Apartments, Mall, Tower, Hotel). Mortgage, sell buildings, trade with other players, draw Nawab ka Farman / Hyderabadi Khazana cards, pay GHMC tax.
* **Jail.** Go to Jail, a card or a trap sends you to Chanchalguda Jail: roll a six, pay ₹500 bail or use a Get Out of Jail Free card; a failed roll costs one turn.
* **Short of cash?** The debt phase lets you mortgage and sell to pay; if you still cannot, you are bankrupt and your assets go to the creditor (or the bank). You can also resign.
* **Win** by reaching the end cash limit in net worth first, by being the last player standing, or by being richest when the round limit (50 by default) runs out.
* **Five features on top:**
  * **Snatch**: everyone starts with a Snatch token; when someone buys a property the others get a 3-second window to grab it for free (the buyer still pays). Several snatchers bid in sealed bidding.
  * **Shield**: spend a token on *Buy + Shield* and nobody can snatch that purchase.
  * **Tokens**: earn more (max 3) every third lap and by landing on the Irani Chai & Biryani Break square.
  * **City events**: every fifth round a random event (monsoon, IPL night, metro strike, tax holiday, Bonalu gift) changes rents, taxes or cash for that round.
  * **Traps**: each player secretly places one trap before rolling; the first other player to land on it goes straight to jail.

The complete rules, state machine and wire protocol are in [`docs/GAME_RULES.md`](docs/GAME_RULES.md).

## Documentation map

| File | What it is |
|---|---|
| [`docs/GAME_RULES.md`](docs/GAME_RULES.md) | Current rules, phases, bankruptcy / winning, the WebSocket protocol, events, timers, redaction, known discrepancies |
| [`docs/MARKETPLACE.md`](docs/MARKETPLACE.md) | Marketplace contract: hub flow, routes, game manifest, settings schema, server adapter, database and API additions |
| [`docs/ADDING_A_GAME.md`](docs/ADDING_A_GAME.md) | How to add the next game as a plugin |
| [`docs/CONTRACT.md`](docs/CONTRACT.md) | Historical build contract of the original app (engine, backend, DB); outdated where it mentions bots, voices, two dice or the 28-tile board |
| [`hyderabad-monopoly.md`](hyderabad-monopoly.md) | Board spec: tiles, prices, rents |

## Requirements

Node 24+, npm, a free Cloudflare account, a free [Neon](https://neon.tech) database, a Google Cloud project (for Sign-In).

## Run it locally

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

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on :5173 (proxies `/api` and `/ws` to the Worker; `API_PORT=8791 npm run dev` points it at another Worker) |
| `npm run worker` | `wrangler dev --port 8787`: API, WebSockets, Durable Objects, and the built app from `dist/` |
| `npm run build` / `npm run preview` | production bundle in `dist/` / preview it |
| `npm run migrate` | apply `db/schema.sql` (idempotent, additive only) using `DATABASE_URL` from the environment or `.dev.vars` |
| `npm test` | Vitest: `shared/`, `worker/` and `src/` tests |
| `npm run sim` | `node scripts/simulate.js`: engine-only simulations with the auto-play brain (invariants and balance stats; `--fuzz` plays random legal actions) |
| `npm run deploy` | `npm run build && wrangler deploy` |

`.dev.vars` keys: `DATABASE_URL` (Neon), `JWT_SECRET` (session signing), `GOOGLE_CLIENT_ID` (optional; without it only guest play works).

Tests (`npm test`) cover the engine (rules, snatch, tokens, events, traps, fuzz to game over), client helpers and the Worker: validation, JWT/cookies/Google-token verification, rate limiting, security headers, the game-adapter registry, the HTTP API with a faked database, rating/leaderboard/room-listing queries, and full in-process runs of the `GameRoom` Durable Object with a fake runtime - including a trivial second game that proves the room is game-agnostic.

Several Workers can run side by side during development: `npx wrangler dev --local --port 8791 --persist-to <folder>` (use a separate `--persist-to` folder per instance; sharing one makes them hang).

### Google OAuth setup

1. [Google Cloud Console](https://console.cloud.google.com/) → create/select a project.
2. **APIs & Services → OAuth consent screen**: user type *External*, app name, support email, developer email. Publish it (or add yourself as a test user while testing).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
4. **Authorized JavaScript origins** (exact origins, no paths, no trailing slash):
   * `http://localhost:5173` (Vite dev)
   * `http://localhost:8787` (Worker dev)
   * your production origin, e.g. `https://gamehub.<your-subdomain>.workers.dev` and/or your custom domain
5. No redirect URIs are needed (the app uses the Google Identity Services button + ID-token callback).
6. Copy the **Client ID** into `.dev.vars` as `GOOGLE_CLIENT_ID` (and into the production secret, below). The client *secret* is not used.

Changes to authorized origins can take a few minutes to apply.

## Configuration reference

| Name | Where | Secret? | Purpose |
|---|---|---|---|
| `DATABASE_URL` | `.dev.vars` / `wrangler secret` | yes | Neon connection string |
| `JWT_SECRET` | `.dev.vars` / `wrangler secret` | yes | HS256 key for the `hyd_session` cookie (≥ 16 chars; use 48+ random bytes) |
| `GOOGLE_CLIENT_ID` | `.dev.vars` / `wrangler secret` | no (public id) | audience check for Google ID tokens; also sent to the browser by `/api/config` |
| `APP_NAME` | `wrangler.toml [vars]` | no | display name returned by `/api/config` (`GameHub`) |

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

The first `wrangler deploy` creates the Worker `gamehub`, applies the Durable Object migration (`v1`: `GameRoom`, `UserHub`, SQLite-backed) and prints the URL, `https://gamehub.<your-subdomain>.workers.dev`.

5. **Add that URL (and any custom domain) to the Google OAuth client's *Authorized JavaScript origins*** (Credentials → your Web client). Without it the Google button shows an origin error. For a custom domain, add a `[[routes]]` block to `wrangler.toml` (`pattern = "play.example.com"`, `custom_domain = true`) and redeploy.
6. **Verify**: `curl https://<your-worker-url>/api/health` → `{"ok":true,"time":"…","db":true}`. `db:false` means the Worker cannot reach Neon (check `DATABASE_URL`). Then open the site, play as guest, create a room.
7. **Logs**: `npx wrangler tail` (live) or Cloudflare dashboard → Workers → gamehub → Logs (observability is enabled).
8. **Rollback**: `npx wrangler deployments list`, then `npx wrangler rollback [version-id]`. Database changes are additive/idempotent, so rolling the code back is safe.

Dry run without logging in (bundles, checks config, uploads nothing): `npm run build && npx wrangler deploy --dry-run --outdir /tmp/out`.

### Continuous deployment (GitHub Actions)

`.github/workflows/deploy.yml` runs on every push to `main`: check secrets → install → `npm test` → `npm run build` → `node scripts/migrate.js` → `wrangler deploy` (via `cloudflare/wrangler-action`) → copy the runtime secrets into the Worker. `.github/workflows/migrate.yml` is a manual (*Run workflow*) migrations-only job.

Create these **repository secrets** (Settings → Secrets and variables → Actions), all five required. The run stops at its first step, naming any that are missing:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → Manage Account → Account API tokens → Create Token → template **Edit Cloudflare Workers** (an R2 token cannot deploy a Worker) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID (right sidebar) |
| `DATABASE_URL` | the production Neon connection string (migration step, and copied into the Worker) |
| `JWT_SECRET` | a new random string for production, e.g. `openssl rand -base64 48` |
| `GOOGLE_CLIENT_ID` | the OAuth Web client id (public) |

With the secrets in place there is no manual `wrangler secret put`: the last step of the workflow writes `DATABASE_URL`, `JWT_SECRET` and `GOOGLE_CLIENT_ID` into the Worker on every deploy. To rotate one, change the GitHub secret and re-run the workflow. You can set secrets without pasting them anywhere shared by running `gh secret set NAME` in your own terminal, which prompts for the value.

## API summary

All JSON, same-origin, cookie session `hyd_session` (`HttpOnly; SameSite=Lax; Path=/; Secure` on https; 30 days). Errors are `{ "error": "message" }` with a proper status (400 invalid input, 401 not signed in, 403 forbidden / guest, 404, 413 body > 16 KB, 429 rate limited).

| Endpoint | Notes |
|---|---|
| `GET /api/health` | `{ ok, time, db }` (db = `select 1` with a 2.5 s timeout). Public. |
| `GET /api/config` | `{ googleClientId \| null, appName }` |
| `POST /api/auth/google {credential}` | verifies the Google ID token (signature via Google JWKS, `aud`, `iss`, `exp`, `email_verified`), upserts the user, sets the cookie → `{ user }` |
| `POST /api/auth/guest {name?, avatar?}` | creates a guest user (`isGuest: true`) → `{ user }` |
| `POST /api/auth/logout` | clears the cookie |
| `GET /api/me` / `PATCH /api/me {name?, avatar?}` | `{ user \| null }`; name ≤ 24 chars, avatar 0–11. `user.gameStats` = `{ [gameId]: { games, wins, bestScore, rating } }` (also on login responses; `xp` / `coins` / `level` stay platform-wide) |
| `GET /api/games` | `{ games:[{ id, name, minPlayers, maxPlayers, openTables }] }` - every game with a server adapter. Public, cached 5 s |
| `GET /api/friends` | `{ friends:[{id,name,avatar,friendCode,online,level}], incoming, outgoing }` (members only) |
| `POST /api/friends/request {friendCode}` | idempotent; a mutual request auto-accepts → `{ ok, status:'pending'\|'accepted', friend }` |
| `POST /api/friends/accept {userId}` · `POST /api/friends/decline {userId}` · `DELETE /api/friends/:userId` | `DELETE` unfriends or cancels an outgoing request |
| `GET /api/friends/by-code/:friendCode` | `{ user:{ id, name, avatar, level, friendCode, relation:'none'\|'friends'\|'outgoing'\|'incoming' } }` for the friend-link screen (members only; your own code is a 400, unknown / guest codes a 404) |
| `POST /api/rooms {gameId?, settings?, maxPlayers?, visibility?}` | → `{ code, gameId }` (201). A missing `gameId` is `hyderabad-tycoon`; an unknown one is `400 unknown game`; `visibility` is `private` (default) or `public`; `settings` are validated by the game's adapter. Guests may host |
| `GET /api/rooms/open?game=<id>&limit=20` | `{ rooms:[{ code, gameId, hostName, players, maxPlayers, summary?, createdAt }] }`: public lobbies with a free seat that were active in the last hour. No sign-in, cached 5 s, max 20 |
| `GET /api/rooms/mine` | `{ rooms:[{ code, gameId, status:'lobby'\|'playing', players, maxPlayers }] }`: live rooms I am a human member of (signed in, guests included) |
| `GET /api/rooms/:code` | `{ code, exists, status:'lobby'\|'playing'\|'finished', players (count), maxPlayers, hostName, isMember, gameId, visibility, settings }` |
| `POST /api/invites {code, userId}` | friend + room-member checks; pushes `{t:'invite', from, code, gameId, gameName}` to that friend's `UserHub` |
| `GET /api/leaderboard?game=<id>\|overall` | `{ rows:[{ rank, name, avatar, level, wins, games, bestScore, rating, bestWorth }] }`, top 50, cached 15 s. No parameter = `overall` (ranked by xp); a game id ranks by wins, then rating. Public to read (guests are never listed); an unknown game is `400 unknown game`. `bestWorth` repeats `bestScore` for older clients |

Friend codes are `HYD-XXXX` and room codes 6 characters, both from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.

### Room settings (validated server-side, in the route *and* again in the room)

Every room has two shared settings that are not part of any game: `visibility` (`private` by default; the app always creates private rooms, `public` is still accepted by the API) and `maxPlayers` (within the game's `minPlayers..maxPlayers`; also accepted inside `settings`). Everything else belongs to the game and is validated by its adapter (`validateSettings`, the source of truth). Hyderabad Tycoon:

| Setting | Accepted | Default |
|---|---|---|
| `goal` ("End cash limit", the only one the lobby shows) | integer 10,000 – 1,000,000 | 70,000 |
| `startCash` | integer 5,000 – 100,000 | 15,000 |
| `maxRounds` | exactly `30`, `50` or `null` (unlimited) | 50 |
| `dice` | `'lucky'` or `'fair'` | `'lucky'` |
| `auctionOnDecline` | boolean | `true` |
| `snatches` (Snatch tokens each player starts with; 0 switches tokens, Shield and Snatch off) | integer 0 – 3 | 1 |
| `snatchMs` (length of the Snatch window) | integer 1,000 – 10,000 | 3,000 |
| `maxPlayers` | integer 2 – 6 (also accepted inside `settings`) | 4 |

The app never shows anything but `goal`: rooms created from the game page use the defaults for the rest. Anything else (strings, floats, `Infinity`, `0`, unknown keys such as `debug`/`seed`) is rejected or ignored. Only the host may change settings, and only while the room is in the lobby. The normalised values appear in `room.settings` and are passed to `createGame`, so `state.cfg` matches.

## WebSocket protocol (summary)

`GET /ws/room/:code` and `GET /ws/user` upgrade only with a valid session cookie and a same-origin `Origin`. The Worker then forwards to the Durable Object with trusted headers (`X-User-Id`, `X-User-Name` (percent-encoded), `X-User-Avatar`, `X-User-Guest`) that clients can never set themselves. Failures are delivered as an application close code so the client can stop retrying: `4001` not signed in, `4003` full / already started / removed, `4004` no such room, `4009` replaced by a newer connection. Connecting to a room with a free seat *is* joining it.

* Client -> room: `ping`, `settings` (host, lobby), `kick` (host, lobby), `start` (host, at least 2 players), `action`, `chat`, `leave`. (`ready` and `visibility` are still accepted by the server but unused by the app; an unknown type, including the retired `addBot` / `removeBot`, gets an `error` and changes nothing.)
* Room -> client: `pong`, `room`, `state` (`{state, events, seq}`, redacted per recipient; the full state every time; on connect/reconnect `events: []`), `error`, `chat`, `kicked`.
* Timers: 45 s per decision then auto-play; 15 s disconnect grace; 30 s trade auto-reject; 3 s Snatch window; 60 s lobby drop; 5 min with nobody connected abandons a game (not recorded); 24 h room expiry.

Every message, field, error string, event, timer and redaction rule is specified in [`docs/GAME_RULES.md`](docs/GAME_RULES.md) section 8.

`/ws/user` pushes `{t:'friend_request',from}` `{t:'friend_accepted',by}` `{t:'invite',from,code,gameId,gameName}` `{t:'presence',userId,online}`.

### Adding a game (server side)

1. Write `worker/games/<id>.js` whose default export is an adapter, and add it to `GAME_ADAPTERS` in `worker/games/index.js` (the interface is documented at the top of that file; `hyderabad-tycoon.js` is the reference implementation, `worker/gameroom.generic.test.js` defines a tiny second game). The id must equal the frontend manifest id.
2. That is all the server needs: `POST /api/rooms {gameId}`, the lobby, idle/disconnect auto-play, timers, per-recipient secrecy, results, stats, ratings, the leaderboard tab and open tables all work through the adapter. Nothing in `GameRoom`, `match.js` or the routes names a game.
3. Run `npx vitest run worker` (the registry test checks the adapter against the required interface).

## Database

`db/schema.sql` (idempotent, additive only): `users`, `friendships` (one row per pair, enforced by a unique index on `(LEAST, GREATEST)`), `matches` (`game_id` (default `hyderabad-tycoon`), `rounds`, `goal`, `max_rounds` (NULL = unlimited), `dice_mode`, `win_reason` incl. `'rounds'`), `match_players` (`hotels_built`, ranks, final worth), `user_game_stats` (`games`, `wins`, `best_score`, `rating`, `extra` per user and game) and `rooms` (the listing behind open tables and "continue playing"; a room's Durable Object keeps its row in step and deletes it on expiry, queries ignore rows older than 24 h). `node scripts/migrate.js` applies it statement by statement (it refuses anything that is not `CREATE … IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, plus the one-time `user_game_stats` backfill, an `INSERT … ON CONFLICT DO NOTHING`) and prints only table names and row counts.

* **Stats.** When a game ends, one atomic statement (guarded by `ON CONFLICT (id) DO NOTHING`, so a retry never counts twice) writes the match with its `game_id` and `match_players`, adds `xp` / `coins` (platform-wide, same formula for every game), upserts `user_game_stats` and - for Hyderabad Tycoon only - keeps the legacy `users.games` / `wins` / `best_worth` / `rent_earned` columns up to date, so the previous version of the app keeps working during a rollout. Matches played on the previous version are not added to `user_game_stats`.
* **Rating** (`worker/rating.js`): Elo-style, new players start at 1000. For every player in a match: `actual = (N - rank) / (N - 1)`, `expected = 1 / (1 + 10^((opponentAverage - own) / 400))` where `opponentAverage` is the mean rating of the other seats, `delta = round(24 * (actual - expected))`, `rating = max(100, rating + delta)`.
* **Rollout order.** Migrate first, then deploy (the deploy workflow does exactly that): the new Worker needs the new columns and tables, while the previous Worker ignores them, so the migration is safe to run ahead of time and rolling the code back needs no database change.

## Security notes

* **Rotate any credential that has ever been pasted into a chat, ticket or commit** (Neon password, `JWT_SECRET`, API tokens). Changing `JWT_SECRET` signs everyone out; rotate the Neon password in the Neon console and update `DATABASE_URL` everywhere (`.dev.vars`, `wrangler secret put`, the GitHub secret). Never commit `.dev.vars`.
* Cookie session: `HttpOnly`, `SameSite=Lax`, `Secure` over https. State-changing requests and WebSocket upgrades from a foreign `Origin` are refused.
* Every input is validated (names ≤ 24 chars with control/invisible characters stripped, avatar 0–11, codes from the unambiguous alphabet, chat ≤ 200 chars, settings as above, every WebSocket message shape and size); SQL is parameterised only; request bodies over 16 KB are rejected while streaming.
* Light in-memory rate limits (per isolate) on auth, room creation, friend requests and friend-code lookups, invites, profile edits, room lookups, open tables, the games list and the leaderboard; WebSocket messages are rate limited per user and chat to one message per 700 ms.
* Security headers: API via middleware (`worker/security.js`), static files via `public/_headers` (CSP allowing only the app itself plus Google Identity Services, `frame-ancestors 'none'`, HSTS, `nosniff`, referrer and permissions policies; hashed assets are `immutable`, `index.html` is `no-cache`).
