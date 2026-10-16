# Hyderabad Tycoon — build contract

A Hyderabad-themed Monopoly-style business game. Mobile-first, desktop-friendly.
Reference screenshot: `photo_2026-10-16_15-04-12.jpg` in the repo root (read it with your image reader).
Stack: React 19 + Vite 8 (plain JS/JSX, **no TypeScript**), Cloudflare Worker (Hono) + Durable Objects, Neon Postgres, Google login.

## 0. Rules for every agent
1. **Own only your files** (section 1). Never edit another owner's file, even to unblock yourself. Other agents are building the rest at the same time, so a module you import may not exist yet. Code against this contract. If you need something not in it, code defensively and write it in your report.
2. **Never edit** `package.json`, `package-lock.json`, `vite.config.js`, `index.html`, `src/styles/tokens.css`, `shared/board.js`, `shared/format.js`, `.dev.vars` or this file. All deps are already installed: react, react-dom, react-router-dom, qrcode.react, hono, jose, @neondatabase/serverless, vitest, vite, wrangler, @fontsource/baloo-tammudu-2, @fontsource/noto-sans-telugu. Need another dep? Say so in your report; don't install.
3. **No git commit/push.** **Never print or copy secrets** (`.dev.vars`). Read them only through the code paths that need them.
4. Import aliases: `@shared/...` → `shared/`, `@/...` → `src/`. Worker code uses relative imports (`../shared/engine.js`).
5. Verify your own work. Syntax-check files with `node_modules/.bin/esbuild <files> --loader:.js=jsx --log-level=warning --outdir=<scratchpad dir>`. Run `npx vitest run <path>` for tests. `npx vite build` only works once every module exists, so don't depend on it. Put throwaway files in your scratchpad dir, not in the repo.
6. UI rules: mobile-first (360–430px phones) and good at ≥1280px desktop; touch targets ≥44px; use CSS variables from `src/styles/tokens.css` (`--gold`, `--surface`, `--font-display`, …); money is always shown with `formatINR` / `compactINR` from `@shared/format.js`; respect `prefers-reduced-motion`; keyboard accessible (visible focus, Space/Enter on main buttons); no external network assets (fonts come from @fontsource, art is inline SVG/CSS).
7. Final report ≤200 words: what you built, public exports, deviations from this contract, known gaps.

## 1. File ownership
| Owner | Files |
|---|---|
| orchestrator (done) | `package.json`, `vite.config.js`, `index.html`, `.gitignore`, `.dev.vars`, `docs/CONTRACT.md`, `shared/board.js`, `shared/format.js`, `src/styles/tokens.css` |
| **engine** | `shared/engine.js`, `shared/cards.js`, `shared/rng.js`, `shared/bots.js`, `shared/index.js`, `shared/*.test.js`, `scripts/simulate.js` |
| **dice** | `shared/dice.js`, `shared/dice.test.js` |
| **voices-tiles** | `src/data/actors.js`, `src/data/voices.tiles.js` |
| **voices-events** | `src/data/voices.events.js`, `src/data/story.js`, `src/data/campaign.js`, `public/voices/README.md`, `public/voices/manifest.json` |
| **art** | `src/components/art/**`, `public/favicon.svg` |
| **lib** | `src/lib/storage.js`, `src/lib/sfx.js`, `src/lib/voice.js`, `src/lib/voiceLines.js`, `src/lib/messages.js`, `src/lib/session/**` (`usePresenter.js`, `useOfflineGame.js`) |
| **gameui-board** | `src/components/game/{Board,Tile,Pawn,Dice,CenterStage}.jsx`, `src/styles/board.css` |
| **gameui-panels** | every other file in `src/components/game/**` (incl. `GameView.jsx`), `src/pages/OfflineGame.jsx`, `src/styles/game.css` |
| **shell** | `src/main.jsx`, `src/App.jsx`, `src/styles/global.css`, `src/styles/home.css`, `src/components/shell/**`, `src/pages/{Splash,Home,PlaySetup,Campaign,SettingsPage,Leaderboard,NotFound}.jsx` |
| **backend** | `wrangler.toml`, `worker/**`, `db/**`, `scripts/migrate.js`, `README.md`, `.github/**`, `public/_headers` |
| **online** | `src/lib/api.js`, `src/lib/auth.jsx`, `src/lib/socket.js`, `src/lib/session/useOnlineGame.js`, `src/components/online/**`, `src/pages/{Login,Friends,Lobby,JoinRoom,OnlineGame}.jsx`, `src/styles/online.css` |

## 2. Board (`shared/board.js`, already written — read it)
Exports: `BOARD_SIZE=28`, `START_TILE=0`, `AUCTION_TILE=7`, `JAIL_TILE=14`, `KISMET_CORNER=21`, `MAX_LEVEL=4`, `LEVEL_NAMES(_TE)`, `RENT_RATE`, `UPGRADE_RATIO`, `TRANSPORT_RENT`, `UTILITY_MULT`, `SELL_RATIO`, `GROUPS`, `TILES`, `TILE_TYPES`, `GROUP_TILES`, `isBuyable(tile)`, `rentFor(tile, level)`, `upgradeCost(tile)`, `tilePosition(i) → {col,row}` (8x8 grid, row 0 = top).
Tile: `{ id, type, corner?, name, te, short, price?, group?, art, emoji, lore }`.
Layout is clockwise from START (bottom-left): left column 0..7 going up (7 = Auction corner, top-left), top row 8..14 going right (14 = Jail, top-right), right column 15..21 going down (21 = Kismet corner, bottom-right), bottom row 22..27 going left, then back to 0. `tilePosition()` in `shared/board.js` is the single source of truth.
Levels: 0 plot, 1 Kirana, 2 Apartments, 3 Mall, 4 Tower, **5 Hotel** (capstone, `MAX_LEVEL = 5`; see 3c). Anything that was hard-coded for "4 levels" must use `MAX_LEVEL`/`LEVEL_NAMES` instead.

## 3. Engine (`shared/*`) — pure, deterministic, runs in the browser AND the Worker
```js
import { createGame, applyAction, getOptions, canUpgrade, previewRent, netWorth, standings,
         nextBotMove, DEFAULT_SETTINGS, PLAYER_COLORS, KISMET } from '@shared/index.js';
```
- `createGame({ players:[{id,name,avatar,isBot?,bot?:{reserve,greed}}], settings?, seed? }) → state` (2–6 players)
- `applyAction(state, action) → { state, events, error? }` — pure, never mutates the input. On an invalid action it returns the SAME state, `events: []` and `error: 'message'`.
- `getOptions(state, playerId) → { roll, bail, buy, skipBuy, endTurn, upgrade:[{tile,cost,level}], bid:null|{tile,min,max}, resign }` (booleans except `upgrade`/`bid`; everything false/null when it is not that player's moment)
- `canUpgrade(state, playerId, tileId) → { ok, reason?, cost }`
- `previewRent(state, tileId, diceSum=7) → number` (rent a visitor would owe right now; 0 if unowned)
- `netWorth(state, playerId)` = cash + Σ(price + level·upgradeCost) of owned tiles. `standings(state) → [{id, cash, worth, rank}]` sorted by worth desc.
- `nextBotMove(state, rnd=Math.random) → action|null` — the next action a bot should take right now (in an auction, the first bot that still has to bid; otherwise the turn player if it is a bot). Returns null if a human must act or the game is over.
- `DEFAULT_SETTINGS = { startCash:15000, goal:70000, passStart:1500, jailTurns:1, bailFine:500, taxAmount:1000, filmFee:800, maxRounds:120 }`
- `PLAYER_COLORS = ['#ff4d6d','#ffd23f','#3ddc97','#4cc9f0','#b794f6','#ff9f43']`
- `KISMET` = array of cards `{ id, kind:'good'|'bad'|'neutral', title, text, te, effect }`.

### State
```js
state = {
  cfg, rng, round, turn /*index into players*/, phase: 'roll'|'buy'|'auction'|'manage'|'over',
  extraRoll: boolean, dice: [a,b], owners: (playerId|null)[28], levels: number[28],
  pending: null | {type:'buy', tile, price} | {type:'auction', tile, minBid, bids:{[playerId]:number}},
  players: [{ id,name,avatar,isBot,color,cash,pos,jailTurns,doubles,bankrupt,bot,
              stats:{rentPaid,rentEarned,taxPaid,propertiesBought,upgrades,jailed,biggestRent} }],
  deck, deckPos, winner: playerId|null, winReason: 'net_worth'|'last_standing'|'rounds'|null, turnCount
}
```
Phases: `roll` (turn player rolls; may pay bail if jailed; may upgrade) → `buy` (unowned tile: BUY or SKIP_BUY) | `auction` (sealed bids from all active players) → `manage` (upgrade, then END_TURN, or ROLL again if `extraRoll` after doubles) → next player's `roll`. Winner when net worth ≥ `cfg.goal`, or last player standing, or `maxRounds` exceeded (richest wins). Rules: two dice; doubles roll again; 3 doubles → jail; passing/landing START pays `passStart`; full colour set = double base rent on level 0 and unlocks upgrades (even-build rule: upgrade only tiles at the group's lowest level); transport rent by count owned (`TRANSPORT_RENT`); utility rent = dice total × `UTILITY_MULT[count]`; Laad Bazaar auction corner auctions a random unowned tile (min bid 50% of price), or pays a ₹500 bonus if none is free; Kismet draws a card; tax tile pays `taxAmount`; Film City pays `filmFee`; Jail: skip a turn unless you roll doubles or pay `bailFine`. Short of cash → the bank auto-sells upgrades then properties at `SELL_RATIO` to cover the debt; still short → bankrupt (assets return to the bank).

### Actions (always include `playerId`)
`{type:'ROLL'}`, `{type:'PAY_BAIL'}`, `{type:'BUY'}`, `{type:'SKIP_BUY'}`, `{type:'UPGRADE', tile}`, `{type:'END_TURN'}`, `{type:'BID', amount}` (0 = pass; sealed; any active player during the auction phase), `{type:'RESIGN'}`.
Test-only: if `state.cfg.debug === true`, `ROLL` honours `action.dice = [a,b]`. The server never sets `debug`.

### Events (what `applyAction` returns; replayed by the UI, broadcast by the server)
| type | fields |
|---|---|
| `dice` | `player, values:[a,b]` |
| `move` | `player, from, to, path:number[] (tile ids, in order, excluding from), passedStart, teleport?` |
| `land` | `player, tile` |
| `cash` | `player, delta (signed), reason, other?` — reasons: `salary rent tax buy upgrade auction card film bail liquidate bazaar` (rent/card transfers emit one event per side; `other` = the counterparty id) |
| `own` | `tile, owner (id|null), reason: 'buy'|'auction'|'liquidate'|'bankrupt'` |
| `level` | `tile, level, reason: 'upgrade'|'liquidate'|'bankrupt'` |
| `jail` | `player, jailed:boolean, reason: 'card'|'three_doubles'|'doubles'|'bail'|'served'` |
| `jail_stay` | `player, left` |
| `card` | `player, cardId, kind, title, text, te` |
| `auction_start` | `tile, minBid` |
| `auction_end` | `tile, winner (id|null), amount, bids:{id:amount}` |
| `bankrupt` | `player` |
| `turn` | `player, round` |
| `win` | `player, reason, worth` |

## 3b. Pre-game settings (added after kickoff — applies to every owner)
The host/player chooses these BEFORE a game starts (Quick Play setup screen, online Lobby host controls; campaign chapters supply their own):
- **Winning target** `goal` (net worth, ₹): presets ₹30,000 · ₹50,000 · ₹70,000 (default) · ₹1,00,000, plus a custom stepper. Valid range 10,000–1,000,000 (integer).
- **Round limit** `maxRounds`: **30 · 50 (default) · Unlimited**. Unlimited is `null` (JSON-safe; never `Infinity`). `undefined` means "use the default". Only 30, 50 and `null` are offered in the UI and accepted by the server.
- **Start cash** `startCash`: presets ₹10,000 · ₹15,000 (default) · ₹20,000 · ₹25,000. Valid range 5,000–100,000.
- **One round = every active (non-bankrupt) player has taken one turn.** Extra rolls from doubles do not add a round. The counter starts at 1 and shows as "Round 7 / 30" (or "Round 7 · ∞" when unlimited). When the last player of round `maxRounds` ends their turn the game ends and the richest player (net worth) wins, `winReason: 'rounds'`. Reaching `goal` ends the game immediately at any time; "last player standing" also ends it.
- Engine: `DEFAULT_SETTINGS.maxRounds = 50`; `createGame` normalises settings (`null` → unlimited, `undefined` → default, anything else must be a positive integer). `state.cfg.maxRounds` is therefore `number|null`. `display.cfg` mirrors `state.cfg`.
- `session.result` also carries `rounds` (rounds played) and `maxRounds`.
- A "settings summary" line is shown everywhere settings are chosen and in the game rules: e.g. "Target ₹70,000 · 50 rounds · Start ₹15,000".

## 3c. Rules v2 — Monopoly-grade business logic (added after kickoff; read `shared/board.js` for the new constants)
Everything below is ADDITIVE to section 3: existing names keep their meaning. Owners: **engine** (all of it except `shared/dice.js`), **dice** agent (`shared/dice.js`, `shared/dice.test.js`).

**Hotel + set bonus.** `MAX_LEVEL = 5`. The Hotel needs every tile in the colour at level ≥ 4 (even-build rule unchanged: you may only raise a tile that sits at the group's lowest level). Rent at level 0 gets the colour-set bonus `setMultiplier(ownedInGroup, groupSize)`: 2-of-3 → ×1.5, full colour → ×2; built tiles use the `RENT_RATE` ladder only (like Monopoly's doubled rent on unimproved lots). Mortgaged tiles still count as owned for the bonus. Building rights only for a FULL colour. Event `set_complete {player, group}` fires when a player completes a colour; `getOptions().sets` lists `{group, owned, size, multiplier}` for UI.

**Dice engine** (`shared/dice.js`; setting `cfg.dice = 'lucky' | 'fair'`, default `'lucky'`). Pure functions that consume `state.rng`:
- `diceWeights(state, playerId, ctx) → { weights:number[36], assist:null|'comeback'|'mercy'|'pity' }` — combo index `(a-1)*6+(b-1)`; weights sum to 1. `ctx = { previewRent(state, tileId, diceSum) }` is injected by the engine (no circular import).
- `rollDice(state, playerId, ctx) → { values:[a,b], assist }` samples one combo with those weights.
- `diceOdds(state, playerId, ctx) → { totals:{2..12:p}, doubles:p, assist }` and `landingOdds(state, playerId, ctx) → number[28]` (probability that the next roll ends on each tile from the player's position; used by the UI odds overlay, so it MUST use the same weights as the real roll).
- `fair` = every one of the 36 combos equally likely. `lucky` = a SLIGHT, disclosed, bounded bias: (1) **comeback assist** — a player below 0.8× the average net worth gets ×1.15 (×1.25 below 0.5×) on combos that land on an unowned buyable tile, START or one of their own tiles, and ×0.85 on combos that land on a tile whose rent is ≥ 25% of their cash; (2) **mercy** — after two consecutive turns in which the player paid rent ≥ ₹1,000, combos landing on an opponent tile whose rent ≥ ₹1,000 get ×0.7 for one roll; (3) **pity doubles** — after 6 non-double rolls in a row doubles get ×1.5; (4) **anti-bust** — after two doubles in the same turn doubles get ×0.5. Every combo's final multiplier is clamped to [0.6, 1.5] before normalising. Player fields: `rollsSinceDouble`, `rentStreak`. The `dice` event gains `assist` (which rule, if any, was active) so the UI can show a subtle "Lucky dice helped" badge.

**Mortgage / sell.** Actions (turn player, phases `roll`/`manage`/`debt`): `{type:'MORTGAGE', tile}` (tile unbuilt and its whole colour has no buildings; bank pays `mortgageValue`), `{type:'UNMORTGAGE', tile}` (costs `unmortgageCost`), `{type:'SELL_BUILDING', tile}` (sells one level, refund = 50% of the build cost, even-sell rule). Mortgaged tiles collect no rent and cannot be built on. Net worth counts a mortgaged tile at price − mortgageValue. State: `mortgaged: boolean[28]`. Events: `mortgage {player,tile,value}`, `unmortgage {player,tile,cost}`, `level` (reason `'sell'`).

**Auction on decline.** `SKIP_BUY` (declining an unowned tile) now triggers the same sealed auction as the Laad Bazaar corner, minimum bid `max(10, round(price*0.1/10)*10)`, when `cfg.auctionOnDecline` (default `true`). Everyone, including the decliner, may bid.

**Debt phase + bankruptcy to a creditor.** Replaces silent auto-liquidation for humans. When a payment (rent, tax, card, bail) exceeds cash but `cash + liquidation value` (mortgage values + building refunds) can cover it → `phase = 'debt'`, `state.debt = {player, amount, creditor|null, reason}`; the debtor raises cash with `MORTGAGE`/`SELL_BUILDING` then `{type:'PAY_DEBT'}` (valid once cash ≥ amount), or `{type:'RESIGN'}`. If even full liquidation cannot cover it → immediate bankruptcy. If bankrupt to a player creditor: buildings are sold to the bank first, all cash goes to the creditor, and the creditor receives every property (mortgaged ones stay mortgaged); if bankrupt to the bank (tax/cards) all properties return unowned. Bots and server timeouts resolve a debt with `nextBotMove` (mortgage cheapest first, sell buildings last). Event `debt {player, amount, creditor}`.

**Jail card.** One Kismet card grants "Get out of jail free": `players[i].jailCards`, action `{type:'USE_JAIL_CARD'}` (jailed, phase `roll`), event `jail` with reason `'card_used'`. The card is returned to the deck.

**Trading.** Turn player only, phases `roll`/`manage` with nothing pending: `{type:'TRADE_OFFER', to, give:{cash,tiles:[]}, get:{cash,tiles:[]}}` → `state.trade = {id, from, to, give, get}` (one at a time; tiles must be owned by the right side and have no buildings in their colour; cash must be affordable). While a trade is pending only `{type:'TRADE_ACCEPT'}` / `{type:'TRADE_REJECT'}` (by `to`) and `{type:'TRADE_CANCEL'}` (by `from`) are legal. Events: `trade_offer {id,from,to,give,get}`, `trade_done {id,from,to,give,get}`, `trade_rejected {id,from,to,reason}`. Bots value the swap (completing a colour counts hugely, breaking their own colour is refused) and answer instantly; they may also propose a simple cash-for-tile offer that completes their own colour to a human at a fair-plus price. The online server auto-rejects a pending offer after 30 s.

**`getOptions` additions:** `mortgage:[{tile,value}]`, `unmortgage:[{tile,cost}]`, `sellBuilding:[{tile,refund}]`, `debt:null|{amount,creditor,shortfall}`, `payDebt:boolean`, `useJailCard:boolean`, `trade:{canOffer:boolean}`, `tradeOffer:null|{id,from,give,get}` (an offer awaiting MY answer), `tradeSent:null|{id,to,give,get}` (my outstanding offer), `sets:[{group,owned,size,multiplier}]`. **State additions:** `mortgaged`, `trade`, `debt`; phase `'debt'`; players gain `jailCards`, `rollsSinceDouble`, `rentStreak`. **Settings additions** (pre-game, like 3b): `dice: 'lucky'|'fair'` (default `'lucky'`), `auctionOnDecline: boolean` (default true).

**Presentation.** `usePresenter` replays the new events (mortgage/unmortgage/trade/debt/set_complete/`assist`) like the old ones. `display` gains `mortgaged`. New voice triggers (events agent): `upgrade_hotel`, `set_complete`, `mortgage`, `trade_done`, `lucky_dice` (the existing `upgrade_tower` now means level 4).

### 3c-impl. As built by the engine (authoritative where it differs from the text above)
- **Tuned defaults:** `startCash 15000, goal 70000, passStart 3200, taxAmount 1000, filmFee 800, maxRounds 50, bailFine 500, jailTurns 1, dice 'lucky', auctionOnDecline true`. Exports `SETTING_LIMITS`, `normalizeSettings`, `liquidationValue`, `diceCtx`.
- **State:** `mortgaged[]`, `trade`, `tradeSeq`, `debt {player, amount, creditor, reason, returnPhase, rest}`, phase `'debt'`. Players also carry `jailCards, rollsSinceDouble, rentStreak, rentThisTurn, lastOfferTurn`.
- **Events:** `mortgage`, `unmortgage`, `debt`, `set_complete`, `trade_offer`, `trade_done`, `trade_rejected` (reason `rejected|cancelled|bankrupt|invalid`). `dice.assist` ∈ `null|'comeback'|'mercy'|'pity'|'antibust'`. Reasons: jail `card_used`; cash `mortgage unmortgage sell trade`; own `trade`; level `sell`. On bankruptcy to a creditor, `own` with reason `bankrupt` carries `owner = creditor id`.
- **Cards:** 17 Kismet cards (incl. `jail_free`).
- **Debt:** the DEBTOR acts during a debt phase even when it is not their turn (`state.debt.player`). A mortgaged tile blocks building on its whole colour. `PAY_BAIL` needs cash ≥ `bailFine`, so mortgage first. Bots offer trades to humans only (cooldown 20 turns).
- **Sealed bids:** `state.pending.bids` holds every bid in plain sight. **A server MUST mask other players' amounts** before sending state to a client (see section 9): replace every other player's amount with `0`, keeping the key so "has bid" stays visible. `auction_end` reveals all bids.

## 4. Content data (`src/data`)
- **Actors** (`actors.js`): `export const ACTORS = [{ id, name, short, color, accent, initials, tts:{pitch,rate} }]` and `export const actorById`. Ids (exactly these 12): `balakrishna chiranjeevi pawankalyan maheshbabu alluarjun prabhas ntr ramcharan nagarjuna venkatesh raviteja brahmanandam`. No real photos or likenesses: monogram badges only.
- **Voice line**: `{ id, actor, te, tn, en, mood }`. `id` is globally unique, as `<2–3 letter actor code>_<tiles: t<tileId>_<n> | events: <trigger>_<n>>`, e.g. `bk_t27_1`, `bk_buy_2`. `te` = Telugu script, `tn` = Telugu in Latin letters (Tenglish), `en` = short English gist, `mood` ∈ `mass|comedy|warm|cool`. **The lines are original and written in each actor's on-screen style. Do not copy film dialogue or song lyrics.** Keep each line ≤ 90 characters so it fits a subtitle toast.
- `voices.tiles.js`: `export default { [tileId]: Line[] }` for ALL 28 tile ids (0..27), ≥3 lines per tile, from different actors where possible. Spread all 12 actors widely: Balakrishna on mass tiles (Banjara Hills, Jubilee Hills, Charminar, Jail…), Brahmanandam on the comic ones, etc.
- `voices.events.js`: `export default { [trigger]: Line[] }`. Trigger keys: `game_start roll doubles pass_start buy buy_premium rent_pay rent_receive rent_big upgrade upgrade_tower jail jail_free card_good card_bad tax film auction_start auction_win auction_lose bankrupt win_me win_other` (≥3 lines each) plus soundboard keys `emote_mass emote_cheer emote_shock emote_laugh emote_thanks emote_hurry emote_taunt` (≥4 lines each).
- `story.js`: `export const STORY_SLIDES = [{ id, title, body, scene }]` (4–5 slides, scene ∈ `charminar|cyberabad|hussainsagar|golconda|banjara`); `export const RIVALS = [{ id, name, tagline, bio, avatar /*0..11*/, bot:{reserve,greed} }]` (8 rivals — Hyderabad archetypes, e.g. "Chai Uncle", "Techie Teja", "Biryani Bhai"); `export const TIPS = string[]` (≥10 loading/menu tips).
- `campaign.js`: `export const CHAPTERS = [{ id, title, te, blurb, scene, rivals:[rivalId], settings:{startCash,goal,passStart?}, reward:{xp,coins} }]` — 5 chapters from "Miyapur Metro Morning" (1 easy rival, goal ₹30,000) to "Banjara Hills Baron" (3 hard rivals, goal ₹70,000). Every chapter's `settings` must be valid engine settings.
- `public/voices/manifest.json`: `{}` initially. Real audio clips: `public/voices/<actorId>/<lineId>.mp3`, registered in the manifest as `{ "bk_t27_1": "balakrishna/bk_t27_1.mp3" }`. If a line has a manifest entry the client plays the clip. Otherwise it shows the subtitle and tries the browser's Telugu text-to-speech. `README.md` explains this to a non-developer in plain language.

## 5. Art (`src/components/art`, import from `@/components/art/index.js`)
Inline SVG React components, flat/isometric style, palette from tokens (hard-coded hex is fine inside SVG).
- `Avatar({ preset /*0..11*/, size=48, ring, className })` — 12 distinct generic characters, no real people. Presets: 0 Biryani Bhai, 1 Chai Uncle (cap, moustache), 2 Techie Teja (glasses, lanyard), 3 Pearl Pasha (turban, sherwani), 4 Auto Anna (khaki), 5 Mass Hero (sunglasses), 6 Kirana Aunty (bindi, bun), 7 Film Producer, 8 Cricket Fan, 9 Coder Girl, 10 Shopkeeper, 11 Netaji (white kurta). Also `export const AVATAR_PRESETS = [{ id, label }]`.
- `TileIcon({ tile, size=32 })` — small icon by `tile.art` (charminar, property, metro, boat, plane, bulb, water, tax, film, kismet, jail, auction).
- `BuildingArt({ level /*0..4*/, color, size })` — property illustration: plot, Kirana, Apartments, Mall, Tower.
- `CenterArt({ tile /*tile object*/, level, color, size })` — large isometric centre-of-board illustration for a tile (like the building in the screenshot): chooses `BuildingArt` for properties, bespoke art for the other `art` keys (Charminar, metro train, boat on lake with Buddha, plane, bulb, water drop, tax paper, film clapper, jail building, auction gavel, kismet card/biryani handi).
- `Scene({ name, className })` — full-bleed SVG backdrops (`preserveAspectRatio="xMidYMid slice"`): `charminar cyberabad hussainsagar golconda banjara night jail`. Night skies, stars (CSS twinkle; disabled for reduced motion), silhouettes (Charminar, Golconda Fort, HITEC/Cyber Towers, Buddha statue, Banjara high-rises).
- `Logo({ size, compact })` — "Hyderabad Tycoon" lockup with a Charminar mark (uses `--font-display`), plus `BrandMark({ size })`.
- `public/favicon.svg`.
- `index.js` re-exports everything.

## 6. Lib (`src/lib`)
- **storage.js** — localStorage with try/catch around every access (private-mode safe), tiny subscribe/notify so hooks update.
  `loadSettings()/saveSettings(patch)`, `useSettings() → [settings, update(patch)]`, settings: `{ sfx:true, voice:true, tts:true, volume:0.8, subtitles:'te'|'tn'|'en'|'off' (default 'te'), reducedMotion:false, actors:{[actorId]:boolean} (default all true) }`.
  `loadProfile()`, `useProfile() → [profile, update(patch)]`, profile: `{ name:'Guest', avatar:0, xp:0, level:1, coins:500, stats:{games,wins,rentEarned,bestWorth,propertiesBought}, lastDailyClaim:null /*'YYYY-MM-DD'*/, dailyStreak:0, seenStory:false }`.
  `levelInfo(xp) → { level, into, need, pct }`; `claimDaily() → { ok, coins, streak }|{ok:false}`; `addMatchResult({ won, rank, worth, rentEarned, propertiesBought, players, chapterId? }) → { xpGained, coinsGained, level, leveledUp }`.
  `loadCampaign()/useCampaign() → { unlocked:1, completed:[chapterId] }`, `completeChapter(id)`.
  `saveGame(state, meta)/loadGame() → {state, meta}|null/clearGame()` — resume of the offline game.
- **sfx.js** — WebAudio synthesised sounds, no asset files: `export const sfx = { unlock(), play(name), setEnabled(b), setVolume(v) }` — names: `click dice step coin pay buy upgrade jail card win lose cheer error`. Respects settings; silent if AudioContext is unavailable.
- **voice.js** — `export const voice = { init(), speak(line, {priority}) → Promise<void>, stop(), onLine(cb) → unsubscribe, ttsAvailable() }`. `onLine` callback gets `{ line, actor, phase:'start'|'end' }` (feeds `VoiceToast`). Plays the manifest clip (`/voices/manifest.json`) if present, else TTS with `lang te-IN`, voice picked from `speechSynthesis.getVoices()` (wait for `voiceschanged`), per-actor `pitch/rate` from `ACTORS[].tts`; if no Telugu voice exists it still emits the line (toast with subtitle, ~3.5 s) and resolves. Honors `settings.voice`, `settings.tts`, `settings.volume` and `settings.actors`. A higher-priority line interrupts a lower one; lower-priority lines are dropped while one is playing.
- **voiceLines.js** — `pickLine(trigger, {avoid=[], actor?}) → Line|null`, `lineForTile(tileId, {avoid}) → Line|null`, `lineById(id)`, `allLines()`. Merges `@/data/voices.tiles.js` + `@/data/voices.events.js`; avoids repeating recent lines; skips disabled actors.
- **messages.js** — `describeEvent(ev, ctx) → { text, tone:'info'|'good'|'bad'|'warn'|'cheer', tile?, icon? } | null`, `ctx = { players:[{id,name}], me }` (use "You" for `me`). English; tile names from `TILES`. Used by the log and the centre bubble.
- **session/usePresenter.js** — the presenter shared by offline and online: `usePresenter({ meId, initialState }) → { display, busy, rolling, bubble, stageTile, log, enqueue(events, newState), reset(state) }`.
  `enqueue` replays an event list with timing (dice roll ~900 ms, token steps ~170 ms each, cash popups, card reveal, auction result…), updating `display` as it goes, firing `sfx` and voice lines (see mapping below), and finally snaps `display` to `newState`. While the queue is non-empty `busy` is true. Calls made during playback are queued in order.
  - `display` = `{ players:[{id,name,avatar,color,cash,pos,jailTurns,bankrupt,isBot}], owners, levels, turn, round, dice:[a,b], phase, goal, cfg }`.
  - `rolling`: true while the dice animate. `bubble`: `{ text, tone, tile?, id }|null`. `stageTile`: tile id for the centre art (the tile the last mover landed on; default 0).
  - `log`: `[{ id, text, tone, player?, tile? }]` newest last, capped at 200.
  - Voice mapping (the principle: never talk over yourself, tile lines always have priority, other lines are flavour): `land` → `lineForTile(tile)` for ANY player; `cash` reason `rent` → `rent_pay` (me paying) / `rent_receive` (me receiving) / `rent_big` when ≥ ₹1,500; `salary` → `pass_start`; `own` reason `buy` → `buy` or `buy_premium` (tile price ≥ ₹3,000); `level` upgrade → `upgrade` (`upgrade_tower` at 4); `jail` true → `jail`; `jail` false → `jail_free`; `card` → `card_good|card_bad`; tax → `tax`; film → `film`; `auction_start/end` → `auction_start/win/lose`; `bankrupt` → `bankrupt`; `win` → `win_me|win_other`; `dice` doubles → `doubles`; game start → `game_start`. Events caused by bots play with ~40% probability, events involving the local player always.
- **session/useOfflineGame.js** — `useOfflineGame({ config:{ players, settings, seed }, resume?:{state}, chapterId? }) → session` (local human id is `config.players.find(p=>!p.isBot).id`, normally `'me'`). Runs the engine locally, drives bots with `nextBotMove` after a ~700–1100 ms think delay while idle (`!busy`), auto-saves with `saveGame` after each action, clears on game over.

### The `session` interface (the ONLY thing `GameView` depends on; `useOnlineGame` returns the same shape)
```js
session = {
  mode: 'offline'|'online',
  me: playerId,
  view: state,                 // authoritative engine state
  display,                     // from usePresenter (animated, may lag `view`)
  busy, rolling, bubble, stageTile, log,   // from usePresenter
  options,                     // getOptions(view, me), but ALL false/null while `busy` or when it isn't my moment
  dispatch(actionWithoutPlayerId),         // adds playerId = me; no-op while busy
  chat: [{id, from, text, emote?}],        // online only; [] offline
  sendChat(text, emote?),                  // offline: just triggers the local voice line for emote keys
  result: null | { winner, reason, standings:[{id,name,avatar,cash,worth,rank}], me:{won,rank,worth,rentEarned,propertiesBought} }, // set only after the win presentation finishes
  connection: 'local'|'connecting'|'open'|'closed',
  restart(), quit()
}
```

## 7. Game UI (`src/components/game`, `src/pages/OfflineGame.jsx`)
- `GameView({ session, onExit })` — the whole game screen (default and named export from `src/components/game/GameView.jsx`). Reproduces the reference screenshot: top bar (back, "₹70,000 net worth to win", ⋯ menu), the board, centre bubble ("You are in jail for 1 round"), dice, player cards (name, cash, `(net worth)`, "Your Turn" pill, bot/online dot), chat/emote bar at the bottom.
- Board = 8×8 CSS grid placed with `tilePosition()`, square, sized with container-query units. 28 tiles with colour header + price tag (`compactINR`), owner flag and building level once bought, centre 6×6 stage with `CenterArt` + speech bubble + dice. Pawns glide tile-to-tile (use `display.players[i].pos`; the presenter steps `pos` one tile at a time).
- Components: `Board`, `Tile`, `Pawn`, `Dice`, `CenterStage`, `PlayerCard`/`PlayerStrip`, `ActionBar` (Roll / Buy ₹X / Skip / Pay bail / Upgrade / End turn — driven by `session.options`), `PropertySheet` (tap any tile: name + Telugu name, lore, rent ladder, owner, upgrade button), `AuctionSheet` (sealed bid: stepper + presets + Pass), `LogPanel`, `EmoteBar` (quick chips: Mass, Cheer, Shock, Laugh, Thanks, Hurry, Taunt → `session.sendChat('', 'emote_mass')` …), `VoiceToast` (subscribes to `voice.onLine`: actor badge + Telugu line big + `tn` smaller + `en` small, honouring `settings.subtitles`), `GameOverModal` (podium + stats + Play again / Home), `MenuSheet` (sound/voice toggles, rules, quit with confirm), `RulesSheet`, `MyProperties` sheet.
- **Board interface** (gameui-board builds it, gameui-panels consumes it): `import Board from './Board.jsx'` → `<Board session={session} onTileClick={(tileId)=>…} highlightTile={tileId|null} />`. The component renders the whole square board including the 6×6 centre stage (art, speech bubble from `session.bubble`, the two dice from `session.display.dice` / `session.rolling`, pawns). Clicking/tapping the dice or pressing Space while `session.options.roll` dispatches `{type:'ROLL'}`. It is square, fills its parent's width (`width:100%; aspect-ratio:1`), and sizes all text with container-query units (`container-type:inline-size` on the board root), so the parent only decides the width (e.g. `min(100%, 100vh - …)`). `board.css` is imported by `Board.jsx` itself. Panels must not restyle board internals. Exports: `Board` (default), `Dice`, `Pawn`, `Tile`.
- Layout: mobile = stacked (top bar, board, player strip, action bar, emote bar; sheets slide up); ≥900px = board left, sidebar right (players, actions, log, emotes); keyboard: Space = roll / confirm main action, Esc closes sheets.
- `OfflineGame.jsx` (route `/game/offline`): reads `useLocation().state` (`{ config, chapterId }`) or `loadGame()` for resume, else `<Navigate to="/play" />`; builds the session with `useOfflineGame`; renders `GameView`; on `session.result` calls `addMatchResult` (and `completeChapter(chapterId)` if the human won a chapter) exactly once.

## 8. Routes and shell
`App.jsx` (shell) wraps everything in `<AuthProvider>` (from `@/lib/auth.jsx`), `<BrowserRouter>`, and lazy-loads pages. Routes: `/` Home · `/story` Splash (story intro) · `/play` PlaySetup (2–4 players vs bots, goal, start cash; navigates to `/game/offline` with `state:{config}`) · `/campaign` · `/game/offline` · `/settings` · `/leaderboard` · `/login` · `/friends` · `/lobby/:code` · `/join` and `/join/:code` · `/game/online/:code` · `*` NotFound.
`AppShell` (shell): night-skyline backdrop (`Scene`), top bar with logo and profile chip, bottom tab bar on mobile (Home · Play · Friends · Profile) / side or top nav on desktop. The game screens (`/game/*`) render without the shell chrome.
Home dashboard (shell): hero with story CTA, profile card (name/avatar editing, level + XP bar, coins), stat tiles, **Quick Play**, **Story Mode**, **Create Room** and **Join with code** (these two call `useAuth()`; signed-out users go to `/login`), daily reward, friends-online strip, leaderboard teaser, rotating tip, "Resume game" if `loadGame()` returns something. First visit (`profile.seenStory` false) → `/story`.
Online pages (owned by *online*): `Login` (Google button via Google Identity Services + "Play as guest"), `Friends` (friend code with copy/share, add by code, requests, online dots, invite to room), `Lobby` (code, QR via qrcode.react, share link and WhatsApp share, players + ready + host settings + add bot + Start), `JoinRoom` (enter code → `/lobby/:code`), `OnlineGame` (uses `useOnlineGame(code)` + `GameView`).
`useAuth()` (`src/lib/auth.jsx`): `{ user|null, loading, configured:boolean /*Google client id present*/, loginWithGoogle(), loginGuest(name), logout(), refresh() }` plus `AuthProvider`. Everything that talks to the Worker goes through `src/lib/api.js` (`api.get/post/patch/del`, throws `{status,message}`; returns JSON). If `/api/me` is unreachable (static dev without the Worker), treat the user as signed out and never crash.

## 9. Backend (Worker + Durable Objects + Neon)
- `wrangler.toml` at the repo root: `name = "hyderabad-tycoon"`, `main = "worker/index.js"`, compatibility_date current, `assets = { directory = "./dist", binding = "ASSETS", not_found_handling = "single-page-application", run_worker_first = ["/api/*", "/ws/*"] }`, SQLite-backed Durable Objects `GAME_ROOM` (class `GameRoom`) and `USER_HUB` (class `UserHub`) via `[[migrations]] new_sqlite_classes`. Secrets/vars: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID` (locally from `.dev.vars`).
- **Auth**: `POST /api/auth/google {credential}` verifies the Google ID token (`jose` + Google JWKS `https://www.googleapis.com/oauth2/v3/certs`, check `aud === GOOGLE_CLIENT_ID`, `iss` ∈ {accounts.google.com, https://accounts.google.com}, `exp`, `email_verified`), upserts the user in Neon and sets an HS256 session JWT (30 days) in the httpOnly cookie `hyd_session` (`SameSite=Lax`, `Path=/`, `Secure` on https). Guests: `POST /api/auth/guest {name}` creates a guest user (`isGuest:true`). Guests can play rooms but cannot use friends or the leaderboard.
- **API** (JSON; errors `{error:'message'}` with proper status):
  - `GET /api/config → { googleClientId:string|null, appName }`
  - `POST /api/auth/google`, `POST /api/auth/guest`, `POST /api/auth/logout`, `GET /api/me → { user|null }`, `PATCH /api/me {name?, avatar?}`
  - `user` = `{ id, name, avatar:int, friendCode:'HYD-7K2Q', isGuest, level, xp, coins, stats:{games,wins,bestWorth,rentEarned} }`
  - `GET /api/friends → { friends:[{id,name,avatar,friendCode,online,level}], incoming:[…], outgoing:[…] }`; `POST /api/friends/request {friendCode}`; `POST /api/friends/accept {userId}`; `POST /api/friends/decline {userId}`; `DELETE /api/friends/:userId`
  - `POST /api/rooms {settings?, maxPlayers?} → { code }`; `GET /api/rooms/:code → { code, exists, status:'lobby'|'playing'|'finished', players, maxPlayers, hostName }`
  - `POST /api/invites {code, userId}` → pushes an `invite` message to that friend's `UserHub`.
  - `GET /api/leaderboard → { rows:[{rank,name,avatar,level,wins,games,bestWorth}] }`
  - Room codes: 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Friend codes `HYD-XXXX` from the same alphabet.
- **WebSockets** (cookie-authenticated in the Worker, then forwarded to the Durable Object with trusted headers `X-User-Id`, `X-User-Name`, `X-User-Avatar`, `X-User-Guest`): `GET /ws/room/:code` → `GameRoom` (id = `idFromName(code)`), `GET /ws/user` → that user's `UserHub`. Use the **WebSocket Hibernation API**.
  - Client → room: `{t:'ready',ready}`, `{t:'settings',settings}` (host, lobby only), `{t:'addBot'}`, `{t:'removeBot',id}`, `{t:'kick',id}` (host), `{t:'start'}` (host, ≥2 players), `{t:'action',action}` (server forces `playerId` = the socket's user), `{t:'chat',text?,emote?}`, `{t:'leave'}`, `{t:'ping'}`.
  - Room → client: `{t:'room', room:{code,status:'lobby'|'playing'|'finished',hostId,maxPlayers,settings,players:[{id,name,avatar,ready,connected,isBot}]}}`, `{t:'state',state,events,seq}` (full state + the events that produced it; on connect/reconnect send the current state with `events:[]`), `{t:'chat',id,from,text,emote}`, `{t:'error',message}`, `{t:'pong'}`, `{t:'kicked'}`.
  - Room rules: the server owns the engine (`../shared/engine.js`). Bots are driven with `nextBotMove` using DO alarms (~900 ms between moves). 45 s turn timer: on timeout the server plays `nextBotMove`-style for the idle human (auto-roll/auto-decide). Disconnected humans are auto-played after 15 s. On game over the match is written to Neon (`matches`, `match_players`) and `users` stats/xp/coins are updated (once). Max players 2–6.
  - `UserHub` messages → client: `{t:'friend_request',from:{id,name,avatar}}`, `{t:'friend_accepted',by:{…}}`, `{t:'invite',from:{id,name,avatar},code}`, `{t:'presence',userId,online}`. Presence = the hub has ≥1 live socket.
- **DB** (`db/schema.sql`, idempotent `CREATE TABLE IF NOT EXISTS`; `scripts/migrate.js` applies it using `DATABASE_URL` from `.dev.vars`/env via `@neondatabase/serverless`): `users`, `friendships`, `matches`, `match_players` (+ indexes). Use parameterised queries only. The Worker uses the `neon()` HTTP driver (works in Workers).
- Worker also exports `GameRoom` and `UserHub` classes and falls through to `env.ASSETS.fetch` for everything else.
- `README.md`: how to run locally (`npm run dev` + `npx wrangler dev`), how to migrate, secrets (`wrangler secret put …`), Google OAuth setup, deploy.

## 10. Quality bar
It must look like a polished mobile game, not a prototype: consistent tokens, smooth transitions, no layout shift, no text overflow on 360px screens, empty/error/loading states everywhere, no console errors.
