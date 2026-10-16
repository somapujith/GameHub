// Hyderabad Tycoon: the first GameHub plugin. Keep this file TINY: no engine, no pages, no React
// components except the two art components. Everything heavy is behind `loaders` (code-split).
// Contract: docs/MARKETPLACE.md section 3. How to add the next game: docs/ADDING_A_GAME.md.
import { TycoonCover, TycoonIcon } from '@/components/art/hub/index.js';
import { GAME_ID } from './constants.js';
import { SETTINGS_SCHEMA, settingsSummary } from './settings.js';
import savedGame from './savedGame.js';

export default {
  id: GAME_ID,
  name: 'Hyderabad Tycoon',
  tagline: 'Buy Miyapur to Banjara Hills',
  description:
    'Roll, buy and build your way across a board of Hyderabad localities. Collect rent, rise to Hotels and out-earn your rivals, with bots offline or friends in a private room.',
  category: 'board',
  status: 'live',
  players: { min: 2, max: 6 },
  duration: '20-40 min',
  theme: { accent: '#ffc857', accent2: '#ff8a3d', bg: '#1b1340' },
  art: { cover: TycoonCover, icon: TycoonIcon },
  modes: { bots: true, friends: true, open: true },
  features: ['Bots', 'Online rooms', 'Voice lines', 'Story mode'],
  howToPlay: [
    { title: 'Roll the die', body: 'Roll one die and move your pawn around the board of Hyderabad localities. A six earns another roll.' },
    { title: 'Buy properties', body: 'Land on a free tile and buy it. Skip it and it can go to a sealed-bid auction that everyone joins.' },
    { title: 'Collect rent', body: 'When a rival lands on your tile they pay rent. Own a whole colour set to earn a bonus.' },
    { title: 'Build up to a Hotel', body: 'Upgrade your set tile by tile, from a plot all the way to a Hotel, for the biggest rents.' },
    { title: 'Win on net worth', body: 'Be first to reach the target net worth, or be the richest when the rounds run out.' },
  ],
  extras: [
    { path: 'story', label: 'Story', icon: 'book', loader: () => import('./Story.jsx') },
    { path: 'campaign', label: 'Campaign', icon: 'map', loader: () => import('./Campaign.jsx') },
  ],
  settings: SETTINGS_SCHEMA,
  summarize: settingsSummary,
  loaders: {
    offlineSetup: () => import('./OfflineSetup.jsx'),
    offlineGame: () => import('./OfflineGame.jsx'),
    onlineGame: () => import('./OnlineGame.jsx'),
    settingsPanel: () => import('./SettingsPanel.jsx'),
  },
  savedGame,
  stats: [
    { key: 'wins', label: 'Wins' },
    { key: 'games', label: 'Games' },
    { key: 'bestScore', label: 'Best net worth' },
  ],
};
