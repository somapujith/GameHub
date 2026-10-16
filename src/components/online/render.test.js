// Render smoke tests (server-side render, node env): every online page / component renders its main states
// without throwing and with the key accessible content. Effects do not run in SSR, so these cover first renders.
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes, StaticRouter } from 'react-router-dom';

vi.mock('@/components/art/index.js', () => ({
  Avatar: ({ preset }) => h('span', { 'data-avatar': preset }),
  AVATAR_PRESETS: Array.from({ length: 12 }, (_, id) => ({ id, label: `Avatar ${id}` })),
  Logo: () => h('span', { 'data-logo': true }),
  Scene: () => h('span', { 'data-scene': true }),
}));

const { AuthContext } = await import('@/lib/auth.jsx');
const { default: Login } = await import('@/pages/Login.jsx');
const { default: Friends } = await import('@/pages/Friends.jsx');
const { default: FriendLink } = await import('@/pages/FriendLink.jsx');
const { default: JoinRoom } = await import('@/pages/JoinRoom.jsx');
const { default: Lobby } = await import('@/pages/Lobby.jsx');
const { default: OnlineGame } = await import('@/pages/OnlineGame.jsx');
const { default: SettingsPanel, SettingField } = await import('./SettingsPanel.jsx');
const { default: PlayerRow } = await import('./PlayerRow.jsx');
const { default: ShareCard } = await import('./ShareCard.jsx');
const { default: CodeInput } = await import('./CodeInput.jsx');
const { default: ConfirmDialog } = await import('./ConfirmDialog.jsx');
const { default: GameIcon } = await import('./GameIcon.jsx');
const { default: VisibilityBadge } = await import('./VisibilityBadge.jsx');
const { default: VisibilityPicker } = await import('./VisibilityPicker.jsx');
const { default: InviteToGameSheet } = await import('./InviteToGameSheet.jsx');
const { InviteBanner, noticeContent } = await import('./InviteBanner.jsx');
const { getGame } = await import('@/games/registry.js');

const base = {
  user: null,
  loading: false,
  configured: false,
  googleClientId: null,
  reachable: true,
  authError: null,
  clearAuthError() {},
  signingIn: false,
  loginWithGoogle: async () => null,
  loginGuest: async () => null,
  logout: async () => {},
  refresh: async () => null,
  reloadConfig: async () => false,
  updateProfile: async () => null,
  subscribe: () => () => {},
  userSocketStatus: 'closed',
};
const member = { id: 'u1', name: 'Ravi', avatar: 2, friendCode: 'HYD-7K2Q', isGuest: false, level: 3, xp: 10, coins: 5, stats: {} };
const guest = { ...member, id: 'g1', name: 'Gita', isGuest: true };

const page = (path, el, auth = {}) =>
  renderToString(h(StaticRouter, { location: path }, h(AuthContext.Provider, { value: { ...base, ...auth } }, el)));
/** Render `el` at `route` (a pattern like '/lobby/:code') when the URL is `path`. */
const routed = (route, path, el, auth = {}) =>
  renderToString(
    h(MemoryRouter, { initialEntries: [path] }, h(AuthContext.Provider, { value: { ...base, ...auth } }, h(Routes, null, h(Route, { path: route, element: el })))),
  );

describe('Login', () => {
  it('signed out + Google configured: guest form, avatar picker, honest guest limits, GameHub copy', () => {
    const html = page('/login', h(Login), { configured: true, googleClientId: 'x.apps.googleusercontent.com' });
    expect(html).toContain('Sign in to GameHub');
    expect(html).toContain('Play as guest');
    expect(html).toContain('Your name');
    expect((html.match(/name="avatar"/g) || []).length).toBe(12);
    expect(html).toContain('Guests cannot add friends');
    expect(html).not.toContain('Hyderabad');
  });
  it('Google not configured: explains it, guest still offered', () => {
    const html = page('/login', h(Login), { configured: false });
    expect(html).toContain('Google login is not configured yet');
    expect(html).toContain('Play as guest');
  });
  it('server unreachable: clear state with retry and offline play', () => {
    const html = page('/login', h(Login), { reachable: false });
    expect(html).toContain('reach the game server');
    expect(html).toContain('Try again');
    expect(html).toContain('/games/hyderabad-tycoon/play');
    expect(html).not.toContain('Play as guest');
  });
  it('loading shows a status instead of the form', () => {
    expect(page('/login', h(Login), { loading: true })).toContain('Checking your session');
  });
  it('guest visiting on purpose sees the upgrade path, not a redirect', () => {
    const html = page('/login?next=/friends', h(Login), { user: guest, configured: true, googleClientId: 'x' });
    expect(html).toContain('Sign in with Google');
    expect(html).toContain('Continue as guest');
    expect(html).toContain('Sign out');
  });
});

describe('Friends', () => {
  it('signed out gate links to login with next', () => {
    const html = page('/friends', h(Friends));
    expect(html).toContain('Sign in to add friends');
    expect(html).toContain('/login?next=');
  });
  it('guest gate', () => {
    const html = page('/friends', h(Friends), { user: guest });
    expect(html).toContain('Friends are for Google accounts');
  });
  it('member: friend code + friend link card, add-by-code form and skeletons while loading', () => {
    const html = page('/friends?room=ABC234', h(Friends), { user: member });
    expect(html).toContain('HYD-7K2Q');
    expect(html).toContain('/f/HYD-7K2Q'); // the friend link (origin + paths.friendLink)
    expect(html).toContain('Copy link');
    expect(html).toContain('Add by code');
    expect(html).toContain('Copy code');
    expect(html).toContain('ho-skel');
    expect(html).toContain('ABC234'); // inviting-to-room banner
  });
  it('an old share link /friends?add= redirects to the friend-link screen instead of rendering the list', () => {
    const html = page('/friends?add=HYD-9ABC', h(Friends), { user: member });
    expect(html).not.toContain('Add by code');
  });
});

describe('FriendLink', () => {
  const at = (path, auth) => routed('/f/:code', path, h(FriendLink), auth);
  it('rejects a link that is not a friend code', () => {
    expect(at('/f/nonsense', { user: member })).toContain('does not look right');
    expect(at('/f/HYD-7K2', { user: member })).toContain('does not look right');
  });
  it('signed out: sign-in prompt that comes back with next=', () => {
    const html = at('/f/HYD-7K2Q');
    expect(html).toContain('Sign in to add this friend');
    expect(html).toContain('/login?next=%2Ff%2FHYD-7K2Q');
  });
  it('guest: explains friends need Google, with the same next=', () => {
    const html = at('/f/HYD-7K2Q', { user: guest });
    expect(html).toContain('Friends are for Google accounts');
    expect(html).toContain('/login?next=%2Ff%2FHYD-7K2Q');
  });
  it('member: looks the friend up (loading state first)', () => {
    expect(at('/f/HYD-7K2Q', { user: member })).toContain('Looking up this friend');
  });
  it('loading auth shows a status', () => {
    expect(at('/f/HYD-7K2Q', { loading: true })).toContain('Opening the friend link');
  });
});

describe('JoinRoom', () => {
  it('returns a signed-in host to room creation after authentication, with a game picker', () => {
    const html = page('/join?host=1', h(JoinRoom), { user: guest });
    expect(html).toContain('Create private room');
    expect(html).toContain('Share your six-character code');
    expect(html).toContain('Pick a game');
    expect(html).toContain('Hyderabad Tycoon');
    expect(html).not.toContain('Enter the 6-character code');
  });
  it('shows the six boxes for a signed-in user', () => {
    const html = page('/join', h(JoinRoom), { user: guest });
    expect(html).toContain('Enter the 6-character code');
    expect((html.match(/ho-code__box/g) || []).length).toBeGreaterThanOrEqual(6);
    expect(html).not.toContain('Hyderabad');
  });
  it('prefills from /join/:code', () => {
    const html = routed('/join/:code', '/join/abc234', h(JoinRoom), { user: guest });
    expect(html).toContain('>A<');
    expect(html).toContain('>4<');
  });
});

describe('Lobby / OnlineGame first render', () => {
  it('lobby connects with a cancel button', () => {
    const html = routed('/lobby/:code', '/lobby/ABC234', h(Lobby), { user: guest });
    expect(html).toContain('Joining the room');
    expect(html).toContain('Cancel');
  });
  it('invalid lobby code', () => {
    const html = routed('/lobby/:code', '/lobby/NOPE', h(Lobby), { user: guest });
    expect(html).toContain('That is not a room code');
  });
  const online = (path, auth = { user: guest }) => routed('/play/:gameId/online/:code', path, h(OnlineGame), auth);
  it('dispatcher: a known game shows a connecting screen until its page and the room check are ready', () => {
    const html = online('/play/hyderabad-tycoon/online/ABC234');
    expect(html).toContain('Joining the match');
    expect(html).not.toContain('gameview');
  });
  it('dispatcher: an unknown game waits for the room lookup (the room may belong to a known game)', () => {
    expect(online('/play/no-such-game/online/ABC234')).toContain('Joining the match');
  });
  it('dispatcher: invalid code and loading states', () => {
    expect(online('/play/hyderabad-tycoon/online/NOPE')).toContain('That is not a room code');
    expect(online('/play/hyderabad-tycoon/online/ABC234', { loading: true })).toContain('Loading...');
  });
});

// A settings schema that is nothing like the first game's: the panel must render any game.
const OTHER_GAME = {
  id: 'other',
  name: 'Other Game',
  players: { min: 2, max: 8 },
  settings: [
    { key: 'mode', label: 'Mode', type: 'segmented', options: ['one', 'two', 'three', 'four', 'five'].map((v) => ({ value: v, label: `Mode ${v}` })), default: 'one' },
    { key: 'time', label: 'Seconds per turn', type: 'stepper', format: 'number', min: 10, max: 120, step: 10, default: 30, help: 'Time to think.' },
    { key: 'hints', label: 'Hints', type: 'toggle', default: false },
  ],
  summarize: (s) => `${s.mode} · ${s.time}s`,
};

describe('SettingsPanel (schema renderer)', () => {
  const tycoon = getGame('hyderabad-tycoon');
  const settings = { goal: 70000, startCash: 15000, maxRounds: 50, dice: 'lucky', auctionOnDecline: true };
  const props = { game: tycoon, settings, maxPlayers: 4, playerCount: 2, onSend() {}, onMaxPlayers() {}, errorId: 0 };

  it("host sees one control per field of the game's own schema", () => {
    const html = renderToString(h(SettingsPanel, { ...props, isHost: true }));
    for (const f of tycoon.settings) expect(html, f.label).toContain(f.label.replace(/&/g, '&amp;'));
    expect(html).toContain('role="switch"');
    expect(html).toContain('role="radio"');
    expect(html).toContain('Custom'); // stepper with quick picks
    expect(html).toContain('Max players');
    expect(html).toContain(tycoon.summarize(settings));
    expect(html).not.toContain('Hyderabad Tycoon'); // the panel itself carries no game name
  });
  it('non-host sees summarize() and read-only chips, no controls', () => {
    const html = renderToString(h(SettingsPanel, { ...props, isHost: false, settings: { ...settings, maxRounds: null, dice: 'fair' } }));
    expect(html).toContain(tycoon.summarize({ ...settings, maxRounds: null, dice: 'fair' }));
    expect(html).toContain('Up to 4 players');
    expect(html).toContain('ho-chip--static');
    expect(html).not.toContain('role="radio"');
    expect(html).not.toContain('role="switch"');
  });
  it('renders a completely different game: wrapped chips for many options, a number stepper, a toggle', () => {
    const html = renderToString(h(SettingsPanel, { ...props, game: OTHER_GAME, settings: { mode: 'two', time: 40, hints: true }, isHost: true, maxPlayers: 5 }));
    expect(html).toContain('Mode three');
    expect(html).toContain('ho-chip'); // 5 options => chips, not a pill row
    expect(html).toContain('Seconds per turn');
    expect(html).toContain('>40<');
    expect(html).toContain('Time to think.');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('two · 40s');
    expect(html).toContain('>5<'); // max players stepper, within 2..8
  });
  it('a game without settings still shows the max-players stepper to the host and a calm summary to others', () => {
    const none = { id: 'bare', name: 'Bare', players: { min: 2, max: 4 } };
    expect(renderToString(h(SettingsPanel, { ...props, game: none, isHost: true }))).toContain('Max players');
    expect(renderToString(h(SettingsPanel, { ...props, game: none, isHost: false }))).toContain('has not changed anything');
    expect(renderToString(h(SettingsPanel, { ...props, game: null, isHost: false }))).toContain('Up to 4 players');
  });
  it('SettingField covers all three types', () => {
    const seg = renderToString(h(SettingField, { field: OTHER_GAME.settings[0], value: 'one', onChange() {}, onStep() {} }));
    expect(seg).toContain('role="radiogroup"');
    const tog = renderToString(h(SettingField, { field: OTHER_GAME.settings[2], value: true, onChange() {}, onStep() {} }));
    expect(tog).toContain('aria-checked="true"');
    const step = renderToString(h(SettingField, { field: OTHER_GAME.settings[1], value: 10, onChange() {}, onStep() {} }));
    expect(step).toContain('disabled=""'); // at the minimum the decrease button is off
  });
});

describe('visibility', () => {
  it('badge says Public or Private', () => {
    expect(renderToString(h(VisibilityBadge, { visibility: 'public' }))).toContain('Public');
    expect(renderToString(h(VisibilityBadge, { visibility: 'private' }))).toContain('Private');
    expect(renderToString(h(VisibilityBadge, {}))).toContain('Private');
  });
  it('host picker explains that public rooms appear in Open tables', () => {
    const pub = renderToString(h(VisibilityPicker, { visibility: 'public', onPick() {} }));
    expect(pub).toContain('Public rooms appear in Open tables');
    expect(pub).toContain('role="radiogroup"');
    const priv = renderToString(h(VisibilityPicker, { visibility: 'private', onPick() {} }));
    expect(priv).toContain('Private rooms need the code or link');
  });
});

describe('small components', () => {
  it('PlayerRow tags: host, you, bot; kick button label', () => {
    const p = { id: 'a', name: 'Anil', avatar: 1, ready: true, connected: true, isBot: false };
    const html = renderToString(h(PlayerRow, { player: p, isHost: true, isMe: true, canRemove: false }));
    expect(html).toContain('Anil');
    expect(html).toContain('Host');
    expect(html).toContain('You');
    const bot = renderToString(h(PlayerRow, { player: { ...p, id: 'bot_1', name: 'Chai Uncle', isBot: true }, canRemove: true, onRemove() {} }));
    expect(bot).toContain('Bot');
    expect(bot).toContain('Remove bot Chai Uncle');
  });
  it('ShareCard: big code, join link, WhatsApp text naming the game, QR svg', () => {
    const html = renderToString(h(ShareCard, { code: 'ABC234', gameName: 'Ludo Lanes' }));
    expect(html).toContain('ABC 234');
    expect(html).toContain('/join/ABC234');
    expect(html).toContain('wa.me/?text=');
    expect(html).toContain(encodeURIComponent('Ludo Lanes'));
    expect(html).toContain('<svg');
    expect(html).toContain('Copy link');
  });
  it('CodeInput renders six boxes with the typed characters', () => {
    const html = renderToString(h(CodeInput, { value: 'AB2', onChange() {} }));
    expect((html.match(/ho-code__box/g) || []).length).toBeGreaterThanOrEqual(6);
    expect(html).toContain('>A<');
    expect(html).toContain('autoCapitalize="characters"');
    expect(html).toContain('value="AB2"');
  });
  it('ConfirmDialog is accessible when open and absent when closed', () => {
    expect(renderToString(h(ConfirmDialog, { open: false, title: 'x' }))).toBe('');
    const html = renderToString(h(ConfirmDialog, { open: true, title: 'Remove Ravi?', body: 'Sure?', confirmLabel: 'Remove' }));
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Remove Ravi?');
  });
  it('GameIcon draws the game art, or the initial when there is none', () => {
    const Art = ({ size }) => h('svg', { 'data-art': size });
    expect(renderToString(h(GameIcon, { game: { name: 'X', art: { icon: Art }, theme: { accent: '#fff' } }, size: 40 }))).toContain('data-art="40"');
    expect(renderToString(h(GameIcon, { game: null, name: 'mystery' }))).toContain('>M<');
    expect(renderToString(h(GameIcon, {}))).toContain('>?<');
  });
  it('InviteToGameSheet lists the live games the friend can be invited to', () => {
    const html = renderToString(h(StaticRouter, { location: '/friends' }, h(InviteToGameSheet, { friend: { id: 'f1', name: 'Mira' }, onClose() {} })));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Invite Mira');
    expect(html).toContain('Hyderabad Tycoon');
  });
  it('InviteBanner (outside a router) renders nothing when empty and a portal-less SSR is safe', () => {
    expect(renderToString(h(InviteBanner, { items: [], onDismiss() {} }))).toBe('');
  });
  it('invite notices name the game and join through the join page', () => {
    const n = noticeContent({ kind: 'invite', from: { name: 'Ravi' }, code: 'ABC234', gameName: 'Ludo Lanes' });
    expect(n.title).toBe('Ravi invited you to play Ludo Lanes');
    expect(n.target).toBe('/join/ABC234');
    expect(n.actionLabel).toBe('Join');
    expect(noticeContent({ kind: 'invite', from: { name: 'Ravi' }, code: 'ABC234' }).title).toBe('Ravi invited you to play');
    expect(noticeContent({ kind: 'invite', from: null }).target).toBeNull();
    expect(noticeContent({ kind: 'friend_request', from: { name: 'Mira' } })).toMatchObject({ target: '/friends', actionLabel: 'View' });
    expect(noticeContent({ kind: 'friend_accepted', from: { name: 'Mira' } }).title).toContain('accepted');
  });
});
