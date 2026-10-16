// Render smoke tests (server-side render, node env): every online page / component renders its main states
// without throwing and with the key accessible content. Effects do not run in SSR, so these cover first renders.
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';

vi.mock('@/components/art/index.js', () => ({
  Avatar: ({ preset }) => h('span', { 'data-avatar': preset }),
  AVATAR_PRESETS: Array.from({ length: 12 }, (_, id) => ({ id, label: `Avatar ${id}` })),
  Logo: () => h('span', { 'data-logo': true }),
  Scene: () => h('span', { 'data-scene': true }),
}));
vi.mock('@/components/game/GameView.jsx', () => ({ default: () => h('div', { id: 'gameview' }), GameView: () => null }));
vi.mock('@/lib/session/usePresenter.js', () => ({
  usePresenter: () => ({ display: { players: [], phase: 'roll' }, busy: false, rolling: false, bubble: null, stageTile: 0, log: [], enqueue() {}, reset() {} }),
  default: () => null,
}));
vi.mock('@/lib/voiceLines.js', () => ({ pickLine: () => null }));
vi.mock('@/lib/voice.js', () => ({ voice: { speak() {} }, default: {} }));

const { AuthContext } = await import('@/lib/auth.jsx');
const { default: Login } = await import('@/pages/Login.jsx');
const { default: Friends } = await import('@/pages/Friends.jsx');
const { default: JoinRoom } = await import('@/pages/JoinRoom.jsx');
const { default: Lobby } = await import('@/pages/Lobby.jsx');
const { default: OnlineGame } = await import('@/pages/OnlineGame.jsx');
const { default: SettingsPanel } = await import('./SettingsPanel.jsx');
const { default: PlayerRow } = await import('./PlayerRow.jsx');
const { default: ShareCard } = await import('./ShareCard.jsx');
const { default: CodeInput } = await import('./CodeInput.jsx');
const { default: ConfirmDialog } = await import('./ConfirmDialog.jsx');
const { InviteBanner } = await import('./InviteBanner.jsx');

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

describe('Login', () => {
  it('signed out + Google configured: guest form, avatar picker, honest guest limits', () => {
    const html = page('/login', h(Login), { configured: true, googleClientId: 'x.apps.googleusercontent.com' });
    expect(html).toContain('Sign in to play online');
    expect(html).toContain('Play as guest');
    expect(html).toContain('Your name');
    expect((html.match(/name="avatar"/g) || []).length).toBe(12);
    expect(html).toContain('Guests cannot add friends');
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
    expect(html).toContain('/play');
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
  it('member: code card, add form and skeletons while loading', () => {
    const html = page('/friends?room=ABC234', h(Friends), { user: member });
    expect(html).toContain('HYD-7K2Q');
    expect(html).toContain('Add a friend');
    expect(html).toContain('Copy code');
    expect(html).toContain('ho-skel');
    expect(html).toContain('ABC234'); // inviting-to-room banner
  });
});

describe('JoinRoom', () => {
  it('returns a signed-in host to room creation after authentication', () => {
    const html = page('/join?host=1', h(JoinRoom), { user: guest });
    expect(html).toContain('Create private room');
    expect(html).toContain('Share your six-character code');
    expect(html).not.toContain('Enter the 6-character code');
  });
  it('shows the six boxes for a signed-in user', () => {
    const html = page('/join', h(JoinRoom), { user: guest });
    expect(html).toContain('Enter the 6-character code');
    expect((html.match(/ho-code__box/g) || []).length).toBeGreaterThanOrEqual(6);
  });
  it('prefills from /join/:code', async () => {
    const { Routes, Route } = await import('react-router-dom');
    const html = page('/join/abc234', h(Routes, null, h(Route, { path: '/join/:code', element: h(JoinRoom) })), { user: guest });
    expect(html).toContain('>A<');
    expect(html).toContain('>4<');
  });
});

describe('Lobby / OnlineGame first render', () => {
  it('lobby connects with a cancel button', async () => {
    const { Routes, Route } = await import('react-router-dom');
    const html = page('/lobby/ABC234', h(Routes, null, h(Route, { path: '/lobby/:code', element: h(Lobby) })), { user: guest });
    expect(html).toContain('Joining the room');
    expect(html).toContain('Cancel');
  });
  it('invalid lobby code', async () => {
    const { Routes, Route } = await import('react-router-dom');
    const html = page('/lobby/NOPE', h(Routes, null, h(Route, { path: '/lobby/:code', element: h(Lobby) })), { user: guest });
    expect(html).toContain('That is not a room code');
  });
  it('online game shows a connecting screen until the first state', async () => {
    const { Routes, Route } = await import('react-router-dom');
    const html = page('/game/online/ABC234', h(Routes, null, h(Route, { path: '/game/online/:code', element: h(OnlineGame) })), { user: guest });
    expect(html).toContain('Joining the match');
    expect(html).not.toContain('gameview');
  });
});

describe('SettingsPanel', () => {
  const settings = { goal: 70000, startCash: 15000, maxRounds: 50, dice: 'lucky', auctionOnDecline: true };
  const props = { settings, maxPlayers: 4, playerCount: 2, onSend() {}, onMaxPlayers() {}, errorId: 0 };
  it('host sees every control', () => {
    const html = renderToString(h(SettingsPanel, { ...props, isHost: true }));
    for (const s of ['Winning target', '₹30,000', '₹70,000', '₹1,00,000', 'Custom', 'Rounds', 'Unlimited', 'One round = every player plays once', 'Start cash', '₹10,000', '₹25,000', 'Dice', 'Lucky', 'Fair', 'Lucky dice gently help whoever is behind', 'Auction when a player skips a property', 'Max players']) {
      expect(html, s).toContain(s);
    }
    expect(html).toContain('Target ₹70,000 · 50 rounds · Start ₹15,000 · Lucky dice');
    expect(html).toContain('role="switch"');
  });
  it('non-host sees a read-only summary and chips, no controls', () => {
    const html = renderToString(h(SettingsPanel, { ...props, isHost: false, settings: { ...settings, maxRounds: null, dice: 'fair' } }));
    expect(html).toContain('Target ₹70,000 · Unlimited rounds · Start ₹15,000 · Fair dice');
    expect(html).toContain('Up to 4 players');
    expect(html).not.toContain('role="radio"');
    expect(html).not.toContain('role="switch"');
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
  it('ShareCard: big code, link, WhatsApp, QR svg', () => {
    const html = renderToString(h(ShareCard, { code: 'ABC234' }));
    expect(html).toContain('ABC 234');
    expect(html).toContain('wa.me/?text=');
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
  it('InviteBanner (outside a router) renders nothing when empty and a portal-less SSR is safe', () => {
    expect(renderToString(h(InviteBanner, { items: [], onDismiss() {} }))).toBe('');
  });
});
