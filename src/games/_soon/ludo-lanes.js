import makeSoon from './make.js';

export default makeSoon({
  id: 'ludo-lanes',
  name: 'Ludo Lanes',
  tagline: 'Race four tokens home before your friends',
  description: 'The classic dice race with quick rounds, bold lanes and plenty of friendly sabotage.',
  category: 'board',
  players: { min: 2, max: 4 },
  duration: '15-30 min',
  theme: { accent: '#ff5d73', accent2: '#ffb84d', bg: '#2a1030' },
  features: ['Online rooms', 'Bots', 'Quick rounds'],
});
