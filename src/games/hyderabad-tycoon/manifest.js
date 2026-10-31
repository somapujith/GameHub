// Hyderabad Tycoon: the first GameHub plugin. Keep this file TINY: no engine, no pages, no React
// components except the two art components. Everything heavy is behind `loaders` (code-split).
// Contract: docs/MARKETPLACE.md section 3. How to add the next game: docs/ADDING_A_GAME.md.
import { TycoonCover, TycoonIcon } from '@/components/art/hub/index.js';
import { GAME_ID } from './constants.js';
import { LOBBY_SETTINGS, SETTINGS_SCHEMA, TABLE_RULES, settingsSummary } from './settings.js';

export default {
  id: GAME_ID,
  name: 'Hyderabad Tycoon',
  tagline: 'Buy Dilsukhnagar to Banjara Hills',
  description:
    'Roll one die, buy and build your way around a board of Hyderabad localities. Collect rent, rise to Hotels and out-earn your friends in a private room. Spend your Snatch to grab a property the moment someone buys it.',
  category: 'board',
  status: 'live',
  players: { min: 2, max: 6 },
  duration: '20-40 min',
  theme: { accent: '#ffc857', accent2: '#ff8a3d', bg: '#1b1340' },
  art: { cover: TycoonCover, icon: TycoonIcon },
  modes: { friends: true, open: false },
  features: ['Play with friends', 'Hyderabad board'],
  settings: SETTINGS_SCHEMA,
  // the lobby only shows the end-cash limit; rounds, dice, start cash and auction stay at their defaults
  lobbySettings: LOBBY_SETTINGS,
  tableRules: TABLE_RULES, // a read-only line under the lobby settings
  summarize: settingsSummary,
  loaders: {
    onlineGame: () => import('./OnlineGame.jsx'),
  },
  stats: [
    { key: 'wins', label: 'Wins' },
    { key: 'games', label: 'Games' },
    { key: 'bestScore', label: 'Best net worth' },
  ],
};
