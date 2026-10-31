# Hyderabad Tycoon — build contract

A Hyderabad-themed Monopoly-style business game. Mobile-first, desktop-friendly.
Reference screenshot: `photo_2026-10-16_15-04-12.jpg` in the repo root (read it with your image reader).
Stack: React 19 + Vite 8 (plain JS/JSX, **no TypeScript**), Cloudflare Worker (Hono) + Durable Objects, Neon Postgres, Google login.

> **Status: historical build contract of the original single-game app.** It is kept for the original engine API, the backend and the database sections. It is **not** the description of the current game: the rules, state machine, wire protocol,
> events, timers and redaction are in [`GAME_RULES.md`](GAME_RULES.md), the marketplace and plugin contract in [`MARKETPLACE.md`](MARKETPLACE.md) and the pre-game flow in the README ("How a game starts").
> Superseded since this file was written: **two dice / doubles** (now one die, a six rolls again), the **28-tile board** (now 40 tiles), **bots and bot rivals** (rooms are humans only; the bot brain only auto-plays idle seats),
> **voice lines, Telugu text, story, campaign and offline play** (all removed; English only), the **ready toggle and visibility picker** (not in the lobby UI), **open tables** (API only), `passStart` 1,500 / 3,200 (now 2,000)
> and the Laad Bazaar / Film City corners. Sections below are labelled **[current]**, **[corrected]** (rewritten to match the code) or **[historical]** (original text, may be wrong).

## 0. Rules for every agent **[historical]**
(How the original multi-agent build was organised. The current dependency list is `package.json`; fonts are not a dependency any more.)
1. **Own only your files** (section 1). Never edit another owner's file, even to unblock yourself. Other agents are building the rest at the same time, so a module you import may not exist yet. Code against this contract. If you need something not in it, code defensively and write it in your report.
2. **Never edit** `package.json`, `package-lock.json`, `vite.config.js`, `index.html`, `src/styles/tokens.css`, `shared/board.js`, `shared/format.js`, `.dev.vars` or this file. Dependencies were pre-installed (see `package.json`). Need another one? Say so in your report; do not install.
3. **No git commit/push.** **Never print or copy secrets** (`.dev.vars`). Read them only through the code paths that need them.
4. Import aliases: `@shared/...` → `shared/`, `@/...` → `src/`. Worker code uses relative imports (`../shared/engine.js`).
5. Verify your own work. Syntax-check files with `node_modules/.bin/esbuild <files> --loader:.js=jsx --log-level=warning --outdir=<scratchpad dir>`. Run `npx vitest run <path>` for tests. `npx vite build` only works once every module exists, so don't depend on it. Put throwaway files in your scratchpad dir, not in the repo.
6. UI rules: mobile-first (360–430px phones) and good at ≥1280px desktop; touch targets ≥44px; use CSS variables from `src/styles/tokens.css` (`--gold`, `--surface`, `--font-display`, …); money is always shown with `formatINR` / `compactINR` from `@shared/format.js`; respect `prefers-reduced-motion`; keyboard accessible (visible focus, Space/Enter on main buttons); no external network assets (fonts come from @fontsource, art is inline SVG/CSS).
7. Final report ≤200 words: what you built, public exports, deviations from this contract, known gaps.

## 1. File ownership **[historical]**
| Owner | Files |
|---|---|
| orchestrator (done) | `package.json`, `vite.config.js`, `index.html`, `.gitignore`, `.dev.vars`, `docs/CONTRACT.md`, `shared/board.js`, `shared/format.js`, `src/styles/tokens.css` |
| **engine** | `shared/engine.js`, `shared/cards.js`, `shared/rng.js`, `shared/bots.js`, `shared/index.js`, `shared/*.test.js`, `scripts/simulate.js` |
| **dice** | `shared/dice.js`, `shared/dice.test.js` |
| **art** | `src/components/art/**`, `public/favicon.svg` |
| **lib** | `src/lib/storage.js`, `src/lib/sfx.js`, `src/lib/messages.js`, `src/lib/session/**` (`usePresenter.js`) |
| **gameui-board** | `src/components/game/{Board,Tile,Pawn,Dice,CenterStage}.jsx`, `src/styles/board.css` |
| **gameui-panels** | every other file in `src/components/game/**` (incl. `GameView.jsx`), `src/styles/game.css` |
| **shell** | `src/main.jsx`, `src/App.jsx`, `src/styles/global.css`, `src/components/shell/**`, `src/pages/{Home,Leaderboard,NotFound}.jsx` |
| **backend** | `wrangler.toml`, `worker/**`, `db/**`, `scripts/migrate.js`, `README.md`, `.github/**`, `public/_headers` |
| **online** | `src/lib/api.js`, `src/lib/auth.jsx`, `src/lib/socket.js`, `src/lib/session/useOnlineGame.js`, `src/components/online/**`, `src/pages/{Login,Friends,Lobby,JoinRoom,OnlineGame}.jsx`, `src/styles/online.css` |

## 2. Board **[corrected]** (`shared/board.js` is the source of truth; spec in `hyderabad-monopoly.md`)
40 tiles on an 11x11 ring, laid out like classic Monopoly. START (tile 0, Rajiv Gandhi Airport) is the bottom-right corner and play runs **clockwise**: left along the bottom row to the Jail corner (10),
up the left column to the Irani Chai & Biryani Break corner (20), right along the top row to the Go-to-Jail corner (30), then down the right column back to START.
Exports: `BOARD_SIZE=40`, `GRID=11`, `START_TILE=0`, `JAIL_TILE=10`, `PARKING_TILE=20`, `GO_TO_JAIL_TILE=30`, `MAX_LEVEL=5`, `HOTEL_LEVEL`, `LEVEL_NAMES`, `TRANSPORT_RENT`, `UTILITY_MULT`, `SELL_RATIO`, `START_CASH`, `PASS_START`, `BAIL_FINE`, `TOKEN_CAP`, `LAPS_PER_TOKEN`, `TRAPS_EACH`,
`GROUPS`, `TILES`, `TILE_TYPES`, `GROUP_TILES`, `isBuyable`, `rentFor`, `upgradeCost`, `setMultiplier`, `mortgageValue`, `unmortgageCost`, `taxDue`, `tilePosition(i) -> {col,row}` (11x11 grid, row 0 = top), `tileSide(i)`.
Tile: `{ id, type: start|property|transport|utility|kismet|tax|jail|parking|gotojail, corner?, name, short, price?, group?, rent?, houseCost?, mortgage?, deck?, taxFlat?, taxPercent?, art, emoji, lore }` (no translated names).
Levels: 0 plot, 1 Kirana, 2 Apartments, 3 Mall, 4 Tower, **5 Hotel** (`MAX_LEVEL = 5`). `tilePosition()` is the single source of truth for layout.

## 3. Engine (`shared/*`) **[corrected]**: pure, deterministic, runs in the browser AND the Worker
```js
import { createGame, applyAction, getOptions, canUpgrade, previewRent, netWorth, liquidationValue, standings,
         chooseBotAction, DEFAULT_SETTINGS, SETTING_LIMITS, normalizeSettings, PLAYER_COLORS, KISMET, CITY_EVENTS } from '@shared/index.js';
```
- `createGame({ players:[{id,name,avatar}], settings?, seed? }) -> state` (2-6 players; settings are normalised, see `normalizeSettings`). `players[].isBot` / `bot` still exist in the engine for the simulator; the server never sets them.
- `applyAction(state, action) -> { state, events, error? }`: pure, never mutates the input. An invalid action returns the SAME state, `events: []` and `error: 'message'`.
- `getOptions(state, playerId)`: what that player may do right now (keys listed in `GAME_RULES.md` 8.4). The client computes it locally; it is not sent over the wire.
- `canUpgrade`, `previewRent(state, tileId, diceSum=7)`, `netWorth`, `liquidationValue`, `standings(state) -> [{id, cash, worth, rank}]`.
- `chooseBotAction(state, playerId, rnd)`: the move chooser the server uses to auto-play an idle or disconnected seat (and the simulator uses for its bots). `nextBotMove` is the simulator's variant.
- `DEFAULT_SETTINGS = { startCash:15000, goal:70000, passStart:2000, jailTurns:1, bailFine:500, maxRounds:50, dice:'lucky', auctionOnDecline:true, snatches:1, snatchMs:3000 }`; `PLAYER_COLORS`; `KISMET` (24 cards `{ id, kind, title, text, effect }`); `CITY_EVENTS`.

State, phases, actions and events are specified in `GAME_RULES.md` (sections 3, 7, 8.4-8.6). In short: phases `roll buy snatch auction manage debt over`; **one die** (`state.dice = [d]`), a six rolls again;
passing or landing on START pays `passStart`; a full colour set doubles unbuilt base rent and unlocks even building up to the Hotel; stations pay 250/500/1000/2000, utilities 40x / 100x the die;
a skipped tile goes to a sealed auction; cash shortfalls go to the debt phase, then bankruptcy; you win by net worth >= `goal`, as last player standing, or by being richest when `maxRounds` runs out.
Test-only: if `state.cfg.debug === true`, `ROLL` honours `action.dice = [d]`. The server never sets `debug`.

## 3b. Pre-game settings **[current; the full table is `GAME_RULES.md` section 2]**
The host chooses these BEFORE a game starts. Today the lobby shows only the **end-cash limit** (`goal`, below); the other settings keep their defaults and are not shown (the quick flow is described in the README, "Player flow"):
- **End cash limit** (the winning target) `goal` (net worth, ₹): presets ₹30,000 · ₹50,000 · ₹70,000 (default) · ₹1,00,000, plus a custom stepper. Valid range 10,000–1,000,000 (integer).
- **Round limit** `maxRounds`: **30 · 50 (default) · Unlimited**. Unlimited is `null` (JSON-safe; never `Infinity`). `undefined` means "use the default". Only 30, 50 and `null` are offered in the UI and accepted by the server.
- **Start cash** `startCash`: presets ₹10,000 · ₹15,000 (default) · ₹20,000 · ₹25,000. Valid range 5,000–100,000.
- **One round = every active (non-bankrupt) player has taken one turn.** Extra rolls after a six do not add a round. The counter starts at 1 and shows as "Round 7 / 30" (or "Round 7 · ∞" when unlimited). When the last player of round `maxRounds` ends their turn the game ends and the richest player (net worth) wins, `winReason: 'rounds'`. Reaching `goal` ends the game immediately at any time; "last player standing" also ends it.
- Engine: `DEFAULT_SETTINGS.maxRounds = 50`; `createGame` normalises settings (`null` → unlimited, `undefined` → default, anything else must be a positive integer). `state.cfg.maxRounds` is therefore `number|null`. `display.cfg` mirrors `state.cfg`.
- `session.result` also carries `rounds` (rounds played) and `maxRounds`.
- The lobby shows one summary line: "First to reach ₹70,000 wins".

## 3c. Rules v2 **[corrected]**: Monopoly-grade business logic (details and exact error strings: `GAME_RULES.md`)

**Hotel + set bonus.** `MAX_LEVEL = 5`. Owning EVERY property of a colour doubles the base rent of its unbuilt tiles (`setMultiplier`: full colour x2, anything less x1) and is the only way to build; the even-build rule applies. Event `set_complete {player, group}` fires when a player completes a colour.

**Dice** (`shared/dice.js`; setting `cfg.dice = 'lucky' | 'fair'`, default `'lucky'`). Exactly **one die**. `fair` = each face 1/6. `lucky` = a small, disclosed, bounded bias: comeback help for the player behind, mercy after two big rent turns, a pity six after six non-sixes, an anti-streak brake after two sixes
in a turn; every face's multiplier is clamped to [0.6, 1.5] (`DICE_RULES`). The `dice` event carries `values: [d]` and `assist` (`null | 'comeback' | 'mercy' | 'pity' | 'antibust'`). `diceOdds` / `landingOdds` use the same weights as the real roll (the UI odds overlay).

**Mortgage / sell.** `MORTGAGE`, `UNMORTGAGE` (+10%), `SELL_BUILDING` (refund 50% of the build cost, even-sell rule). Mortgaged tiles collect no rent and block building on their whole colour. Net worth counts a mortgaged tile at price - mortgage value.

**Auction on decline.** `SKIP_BUY` opens a sealed auction when `cfg.auctionOnDecline` (minimum bid `max(10, round(price*0.1/10)*10)`); a tile the player cannot afford is not offered at all. (The old Laad Bazaar auction corner no longer exists.)

**Debt phase + bankruptcy to a creditor.** See `GAME_RULES.md` 7.2-7.4: `state.debt = {player, amount, creditor|null, reason, returnPhase, rest}`; the debtor acts out of turn with `MORTGAGE` / `SELL_BUILDING` / `PAY_DEBT` / `RESIGN`; unpayable debts bankrupt the player, whose cash and properties go to the creditor (or the bank).

**Jail card.** One of the 24 Kismet cards is "Get out of jail free" (`jailCards`, `USE_JAIL_CARD`, `jail` reason `card_used`); it returns to the deck when used.

**Trading.** `TRADE_OFFER {to, give:{cash,tiles}, get:{cash,tiles}}` by the turn player in `roll`/`manage` with nothing pending; one offer at a time; the recipient answers with `TRADE_ACCEPT` / `TRADE_REJECT`, the offerer may `TRADE_CANCEL`. Tiles must be owned by the right side with no buildings in their colour. The server auto-rejects an unanswered offer after 30 s. Auto-play never proposes trades.

**Added later** (specified in `GAME_RULES.md`): Snatch (9), Shield and token earning (10), city events (11), traps (13).

**Implementation notes.** Exports `SETTING_LIMITS`, `normalizeSettings`, `liquidationValue`, `diceCtx`. Players carry `jailCards, sixes, rollsSinceSix, rentStreak, rentThisTurn, lastOfferTurn, snatches, laps, traps`. `PAY_BAIL` needs cash >= `bailFine`, so mortgage first.
**Sealed bids:** `state.pending.bids` holds every bid in clear in the engine; the server masks other players' amounts before sending (`worker/mask.js`, `GAME_RULES.md` 8.7). `auction_end` reveals all bids.

## 4. Content data **[removed]**
Voice lines, actors, the story slides, the campaign and the bot rivals (`src/data/*`, `public/voices/**`) no longer exist: the game has no voices or subtitles, no story mode or campaign and no bots.

## 5. Art **[corrected]** (`src/components/art`, import from `@/components/art/index.js`; hub art lives in `src/components/art/hub/`)
Inline SVG React components, flat/isometric style, no assets. Current exports: `Avatar({ preset /*0..11*/, size, ring, className })` + `AVATAR_PRESETS`, `TileIcon({ tile, size })`, `BuildingArt({ level /*0..5*/, color, size })`, `Logo({ size, compact })`, `BrandMark({ size })`.
`CenterArt`, `Scene` and the diorama files were removed with the old centre stage. `public/favicon.svg`.

## 6. Lib (`src/lib`) **[historical, mostly current]**
- **storage.js** — localStorage with try/catch around every access (private-mode safe), tiny subscribe/notify so hooks update.
  `loadSettings()/saveSettings(patch)`, `useSettings() → [settings, update(patch)]`, settings: `{ sfx:true, volume:0.8, reducedMotion:false }` (older persisted objects with extra keys, e.g. the retired voice settings, load fine and the extra keys are ignored).
  `loadProfile()`, `useProfile() → [profile, update(patch)]`, profile: `{ name:'Guest', avatar:0, xp:0, level:1, coins:500, stats:{games,wins,rentEarned,bestWorth,propertiesBought,hotelsBuilt}, lastDailyClaim:null /*'YYYY-MM-DD'*/, dailyStreak:0 }`.
  `levelInfo(xp) → { level, into, need, pct }`; `claimDaily() → { ok, coins, streak }|{ok:false}`. (The offline-game, campaign and match-result helpers were removed with offline play.)
- **sfx.js** — WebAudio synthesised sounds, no asset files: `export const sfx = { unlock(), play(name), setEnabled(b), setVolume(v) }` — names: `click dice step coin pay buy upgrade hotel mortgage trade lucky jail card win lose cheer error`. Respects settings; silent if AudioContext is unavailable.
- **messages.js** — `describeEvent(ev, ctx) → { text, tone:'info'|'good'|'bad'|'warn'|'cheer', tile?, icon? } | null`, `ctx = { players:[{id,name}], me }` (use "You" for `me`). English; tile names from `TILES`. Used by the log and the centre bubble.
- **session/usePresenter.js** — the presenter used by the online game: `usePresenter({ meId, initialState }) → { display, busy, rolling, bubble, stageTile, log, enqueue(events, newState), reset(state) }`.
  `enqueue` replays an event list with timing (dice roll ~900 ms, token steps ~170 ms each, cash popups, card reveal, auction result…), updating `display` as it goes, firing `sfx`, and finally snaps `display` to `newState`. While the queue is non-empty `busy` is true. Calls made during playback are queued in order.
  - `display` = `{ players:[{id,name,avatar,color,cash,pos,jailTurns,bankrupt,isBot}], owners, levels, turn, round, dice:[d], phase, goal, cfg }`.
  - `rolling`: true while the dice animate. `bubble`: `{ text, tone, tile?, id }|null`. `stageTile`: tile id for the centre art (the tile the last mover landed on; default 0).
  - `log`: `[{ id, text, tone, player?, tile? }]` newest last, capped at 200.

### The `session` interface (the ONLY thing `GameView` depends on; `useOnlineGame` returns the same shape)
```js
session = {
  mode: 'online',
  me: playerId,
  view: state,                 // authoritative engine state
  display,                     // from usePresenter (animated, may lag `view`)
  busy, rolling, bubble, stageTile, log,   // from usePresenter
  options,                     // getOptions(view, me), but ALL false/null while `busy` or when it isn't my moment
  dispatch(actionWithoutPlayerId),         // adds playerId = me; no-op while busy
  chat: [{id, from, text, emote?}],
  sendChat(text, emote?),
  result: null | { winner, reason, standings:[{id,name,avatar,cash,worth,rank}], me:{won,rank,worth,rentEarned,propertiesBought} }, // set only after the win presentation finishes
  connection: 'connecting'|'open'|'closed',
  restart(), quit()
}
```

## 7. Game UI **[corrected]** (`src/components/game`)
- `GameView({ session, onExit })` is the whole game screen; it depends only on the `session` interface (section 6). Layout: on wide screens the square board (with the `ControlPanel` in its centre: dice, action buttons, city event banner, Snatch button) next to a scoreboard column (`MoneyBar`, chat); on phones a slim top bar, the board at full width, the scoreboard as a compact list and chat.
- Board = 11x11 CSS grid placed with `tilePosition()`, square, sized with container-query units; 40 tiles with colour header, price tag, owner flag and building level; pawns lift and place tile to tile along `display.players[i].pos`.
- Components: `Board`, `Tile`, `Pawn`, `Dice` (one die), `ControlPanel`, `ActionBar`, `MoneyBar`, `EventBanner`, `PropertySheet` (the tile's deed: rent ladder, owner, build / mortgage / **Set trap here**), `AuctionSheet`, `TradeSheet`, `DebtSheet`, `PlayerSheet`, `MyProperties`, `LogPanel`, `EmoteBar` (Mass, Cheer, Shock, Laugh, Thanks, Hurry, Taunt), `SetCelebration`, `GameOverModal`, `MenuSheet`, `RulesSheet`. English only; no voice, subtitles or translated names.
- Keyboard: Space = roll / confirm main action, Esc closes sheets.

## 8. Routes and shell **[current; hub-level routes are in `MARKETPLACE.md` section 2]**
`App.jsx` (shell) wraps everything in `<AuthProvider>` (from `@/lib/auth.jsx`), `<BrowserRouter>`, and lazy-loads pages. Routes: `/` Home · `/games/:gameId` quick start · `/leaderboard` · `/profile` · `/login` · `/friends` · `/f/:code` · `/lobby/:code` · `/join` and `/join/:code` · `/play/:gameId/online/:code` · `*` NotFound. The old `/story`, `/play`, `/campaign`, `/game/offline` and `/settings` URLs redirect (see `src/platform/paths.js`).
`AppShell` (shell): soft hub backdrop, top bar with logo and profile chip, bottom tab bar on mobile (Home · Play · Friends · Profile) / side or top nav on desktop. The game screens (`/play/**`) render without the shell chrome.
Home (shell): featured-game hero, friends-online strip, browse by category, top players, daily reward. There is no offline mode, story or campaign.
Online pages (owned by *online*): `Login` (Google button via Google Identity Services + "Play as guest"), `Friends` (friend code with copy/share, add by code, requests, online dots, invite to room), `Lobby` (room code, QR via qrcode.react, share link and WhatsApp share, the seat grid, the host's end-cash limit and Start; no bots, ready toggle or visibility picker), `JoinRoom` (enter code → `/lobby/:code`), `OnlineGame` (uses `useOnlineGame(code)` + `GameView`).
`useAuth()` (`src/lib/auth.jsx`): `{ user|null, loading, configured:boolean /*Google client id present*/, loginWithGoogle(), loginGuest(name), logout(), refresh() }` plus `AuthProvider`. Everything that talks to the Worker goes through `src/lib/api.js` (`api.get/post/patch/del`, throws `{status,message}`; returns JSON). If `/api/me` is unreachable (static dev without the Worker), treat the user as signed out and never crash.

## 9. Backend (Worker + Durable Objects + Neon)
- `wrangler.toml` at the repo root: `name = "gamehub"`, `main = "worker/index.js"`, compatibility_date current, `assets = { directory = "./dist", binding = "ASSETS", not_found_handling = "single-page-application", run_worker_first = ["/api/*", "/ws/*"] }`, SQLite-backed Durable Objects `GAME_ROOM` (class `GameRoom`) and `USER_HUB` (class `UserHub`) via `[[migrations]] new_sqlite_classes`. Secrets/vars: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID` (locally from `.dev.vars`).
- **Auth**: `POST /api/auth/google {credential}` verifies the Google ID token (`jose` + Google JWKS `https://www.googleapis.com/oauth2/v3/certs`, check `aud === GOOGLE_CLIENT_ID`, `iss` ∈ {accounts.google.com, https://accounts.google.com}, `exp`, `email_verified`), upserts the user in Neon and sets an HS256 session JWT (30 days) in the httpOnly cookie `hyd_session` (`SameSite=Lax`, `Path=/`, `Secure` on https). Guests: `POST /api/auth/guest {name}` creates a guest user (`isGuest:true`). Guests can play rooms but cannot use friends or the leaderboard.
- **API** (JSON; errors `{error:'message'}` with proper status):
  - `GET /api/config → { googleClientId:string|null, appName }`
  - `POST /api/auth/google`, `POST /api/auth/guest`, `POST /api/auth/logout`, `GET /api/me → { user|null }`, `PATCH /api/me {name?, avatar?}`
  - `user` = `{ id, name, avatar:int, friendCode:'HYD-7K2Q', isGuest, level, xp, coins, stats:{games,wins,bestWorth,rentEarned} }`
  - `GET /api/friends → { friends:[{id,name,avatar,friendCode,online,level}], incoming:[…], outgoing:[…] }`; `POST /api/friends/request {friendCode}`; `POST /api/friends/accept {userId}`; `POST /api/friends/decline {userId}`; `DELETE /api/friends/:userId`
  - `POST /api/rooms {gameId?, settings?, maxPlayers?, visibility?} → { code, gameId }` (original form: `{settings?, maxPlayers?} → { code }`); `GET /api/rooms/:code → { code, exists, status:'lobby'|'playing'|'finished', players (count), maxPlayers, hostName, isMember, gameId, visibility, settings }`. Marketplace additions (`/api/games`, `/api/rooms/open|mine`, `user_game_stats`): `MARKETPLACE.md` section 7
  - `POST /api/invites {code, userId}` → pushes an `invite` message to that friend's `UserHub`.
  - `GET /api/leaderboard → { rows:[{rank,name,avatar,level,wins,games,bestWorth}] }`
  - Room codes: 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Friend codes `HYD-XXXX` from the same alphabet.
- **WebSockets** (cookie-authenticated in the Worker, then forwarded to the Durable Object with trusted headers `X-User-Id`, `X-User-Name`, `X-User-Avatar`, `X-User-Guest`): `GET /ws/room/:code` → `GameRoom` (id = `idFromName(code)`), `GET /ws/user` → that user's `UserHub`. Use the **WebSocket Hibernation API**.
  - **WebSocket room protocol [corrected]**: the complete, current specification (every client and server message, fields, error strings, close codes, the `room` view, the `state` shape, events, redaction, timers, reconnect) is `GAME_RULES.md` section 8. Summary: client -> room `ping`, `settings` (host, lobby), `kick` (host, lobby), `start` (host, >= 2 players), `action {action}` (the server forces `playerId`), `chat {text?, emote?}`, `leave` (the server still accepts the unused `ready` and `visibility` messages); room -> client `pong`, `room`, `state {state, events, seq}` (redacted per recipient; on connect or reconnect `events: []`), `error {message}`, `chat {id, from, name, text, emote, ts}`, `kicked`.
  - Room rules: the server owns the engine (`../shared/engine.js`). There are no bots: every seat is a real player. A player has 45 s per decision; on timeout the server plays the engine's move chooser on their behalf (DO alarms, ~900 ms between moves) and keeps doing so until they act. Disconnected players are auto-played after 15 s. A pending trade offer is auto-rejected after 30 s. On game over the match is written to Neon (`matches`, `match_players`, `user_game_stats`) and `users` xp/coins are updated (once). Max players 2-6.
  - `UserHub` messages → client: `{t:'friend_request',from:{id,name,avatar}}`, `{t:'friend_accepted',by:{…}}`, `{t:'invite',from:{id,name,avatar},code}`, `{t:'presence',userId,online}`. Presence = the hub has ≥1 live socket.
- **DB** (`db/schema.sql`, idempotent `CREATE TABLE IF NOT EXISTS`; `scripts/migrate.js` applies it using `DATABASE_URL` from `.dev.vars`/env via `@neondatabase/serverless`): `users`, `friendships`, `matches`, `match_players` (+ indexes). Use parameterised queries only. The Worker uses the `neon()` HTTP driver (works in Workers).
- Worker also exports `GameRoom` and `UserHub` classes and falls through to `env.ASSETS.fetch` for everything else.
- `README.md`: how to run locally (`npm run dev` + `npx wrangler dev`), how to migrate, secrets (`wrangler secret put …`), Google OAuth setup, deploy.

## 10. Quality bar
It must look like a polished mobile game, not a prototype: consistent tokens, smooth transitions, no layout shift, no text overflow on 360px screens, empty/error/loading states everywhere, no console errors.
