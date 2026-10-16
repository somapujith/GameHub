import makeSoon from './make.js';

export default makeSoon({
  id: 'tambola-night',
  name: 'Tambola Night',
  tagline: 'Call the numbers and shout Housie',
  description: 'Housie for the whole group chat: tickets, numbers, and a lot of noise at the end.',
  category: 'social',
  players: { min: 2, max: 20 },
  duration: '20-30 min',
  theme: { accent: '#4cc9f0', accent2: '#7b6dff', bg: '#101c3d' },
  features: ['Big groups', 'Online rooms'],
});
