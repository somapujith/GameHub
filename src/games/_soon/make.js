// Builds a coming-soon teaser manifest. These are placeholders the owner can rename or delete: only
// id, name, tagline, category, status, players, duration, theme and art are required by the registry.
import { createElement } from 'react';
import { ComingSoonCover, ComingSoonIcon } from '@/platform/game/hubArt.jsx';

export default function makeSoon({ id, name, tagline, description, category, players, duration, theme, features = [] }) {
  return {
    id,
    name,
    tagline,
    description,
    category,
    status: 'coming_soon',
    players,
    duration,
    theme,
    features,
    modes: { bots: false, friends: false, open: false },
    art: {
      cover: (props) => createElement(ComingSoonCover, { id, ...props }),
      icon: (props) => createElement(ComingSoonIcon, { id, rounded: true, ...props }),
    },
  };
}
