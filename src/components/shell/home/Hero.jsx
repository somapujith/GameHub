import { Link } from 'react-router-dom';
import { Scene } from '@/components/art/index.js';
import { Icon } from '../icons.jsx';

export default function Hero({ name }) {
  return (
    <section className="hh-hero" aria-labelledby="hh-hero-title">
      <div className="hh-hero__scene" aria-hidden="true">
        <Scene name="charminar" />
      </div>
      <div className="hh-hero__shade" aria-hidden="true" />
      <div className="hh-hero__body">
        <p className="hh-hero__eyebrow">
          <span lang="te">నమస్తే</span>
          <i aria-hidden="true" />
          Welcome back
        </p>
        <h1 id="hh-hero-title" className="hh-hero__title">
          Namaste, <span className="hh-hero__name">{name}</span>
        </h1>
        <p className="hh-hero__sub">Buy Miyapur to Banjara Hills, collect the rent and become the biggest tycoon in town.</p>
        <div className="hh-hero__cta">
          <Link to="/story" className="btn btn--glass">
            <Icon name="play" size={16} /> Watch the story
          </Link>
          <Link to="/leaderboard" className="btn btn--glass-quiet hh-hero__rank" aria-label="Rankings">
            <Icon name="trophy" size={18} /> <span>Rankings</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
