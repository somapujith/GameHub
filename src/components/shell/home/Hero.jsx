import { Link, useNavigate } from 'react-router-dom';
import { Scene, Avatar } from '@/components/art/index.js';
import { RIVALS } from '@/data/story.js';
import { useProfile } from '../stores.js';
import { Icon } from '../icons.jsx';
import { DEFAULT_AUCTION_ON_DECLINE } from '../gameSettings.js';

export default function Hero() {
  const navigate = useNavigate();
  const [profile] = useProfile();
  const rival = RIVALS.find((r) => r.id === 'biryani-bhai') || RIVALS[0];
  const play = () => navigate('/game/offline', { state: { config: {
    players: [
      { id: 'me', name: profile.name, avatar: profile.avatar, isBot: false },
      { id: 'bot1', name: rival.name, avatar: rival.avatar, isBot: true, bot: rival.bot },
    ],
    settings: { goal: 30000, startCash: 15000, maxRounds: 30, dice: 'fair', auctionOnDecline: DEFAULT_AUCTION_ON_DECLINE },
    seed: Date.now(), speed: 'normal',
  } } });
  return (
    <section className="hh-feature" aria-labelledby="hh-feature-title">
      <div className="hh-feature__art" aria-hidden="true"><Scene name="charminar" /></div>
      <div className="hh-feature__body">
        <p className="hh-feature__tag"><span /> THE CITY IS YOUR BOARD</p>
        <h2 id="hh-feature-title">Thoda chai.<br />Thoda <em>tycoon.</em></h2>
        <p className="hh-feature__copy">From Charminar to Banjara Hills. Buy your favourite spots, collect rent, and give your rival a proper challenge.</p>
        <div className="hh-feature__cta"><button type="button" className="btn btn--primary btn--lg" onClick={play}><Icon name="play" size={17} /> Play a duel</button><Link to="/play" className="hh-feature__custom">Set up your game <Icon name="chevR" size={16} /></Link></div>
        <p className="hh-feature__note"><Icon name="wifiOff" size={14} /> No sign-in needed <i /> You vs Biryani Bhai · 30 rounds</p>
      </div>
      <div className="hh-feature__table" aria-hidden="true"><div className="hh-feature__opponent"><Avatar preset={rival.avatar} size={44} /><span>Biryani Bhai<small>COMPUTER RIVAL</small></span></div><div className="hh-feature__die">{[0, 1, 2, 3, 4].map((n) => <i key={n} />)}</div><span className="hh-feature__banter">“Rent dena, biryani free nahi!”</span></div>
    </section>
  );
}
