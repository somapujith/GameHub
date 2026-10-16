import { Link } from 'react-router-dom';
import Hero from '@/components/shell/home/Hero.jsx';
import ResumeCard from '@/components/shell/home/ResumeCard.jsx';
import QuickActions from '@/components/shell/home/QuickActions.jsx';
import FriendsStrip from '@/components/shell/home/FriendsStrip.jsx';
import { Icon } from '@/components/shell/icons.jsx';
import { useProfile } from '@/components/shell/stores.js';

export default function Home() {
  const [profile] = useProfile();
  return (
    <div className="hh-lounge">
      <header className="hh-lounge__welcome">
        <div><p className="hh-eyebrow">YOUR DAILY ADDA</p><h1>Arrey, {profile.name === 'Guest' ? 'miyaan' : profile.name}! <span>Game on?</span></h1></div>
        <Link to="/settings" className="hh-lounge__profile"><Icon name="user" size={17} /> Make it yours <Icon name="chevR" size={15} /></Link>
      </header>
      <div className="hh-lounge__grid">
        <div className="hh-lounge__main">
          <ResumeCard />
          <Hero />
          <QuickActions />
          <section className="hh-discover" aria-labelledby="discover-title">
            <div className="hh-section-heading"><h2 id="discover-title">A little more Hyderabad</h2><span>Same city. New stories.</span></div>
            <div className="hh-discover__grid">
              <Link to="/campaign" className="hh-discover__card"><span className="hh-discover__icon"><Icon name="map" size={25} /></span><div><h3>From galli to glory</h3><p>Five chapters. A city to make your own.</p><b>Explore story mode <Icon name="chevR" size={15} /></b></div></Link>
              <Link to="/leaderboard" className="hh-discover__card"><span className="hh-discover__icon hh-discover__icon--gold"><Icon name="trophy" size={25} /></span><div><h3>Who runs the city?</h3><p>See the tycoons climbing the rankings.</p><b>View leaderboard <Icon name="chevR" size={15} /></b></div></Link>
            </div>
          </section>
        </div>
        <aside className="hh-lounge__side">
          <FriendsStrip />
          <section className="hh-howto" aria-labelledby="how-title"><p className="hh-eyebrow">FIRST TIME AT THE TABLE?</p><h2 id="how-title">Big dreams. One little die.</h2><ol><li><span>01</span><div><b>Roll & explore</b><p>Move through Hyderabad, one neighbourhood at a time.</p></div></li><li><span>02</span><div><b>Buy & build</b><p>Collect a colour set, build up and earn rent.</p></div></li><li><span>03</span><div><b>Make your move</b><p>Reach the net worth target, or lead when the rounds end.</p></div></li></ol><Link to="/story" className="hh-link">Meet your city <Icon name="chevR" size={16} /></Link></section>
        </aside>
      </div>
      <footer className="hh-lounge__foot"><span>Made for a proper Hyderabad adda.</span><span>Virtual properties. Real bragging rights.</span></footer>
    </div>
  );
}
