import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../icons.jsx';
import { apiPost } from '../net.js';
import { useAccount } from '../hooks.js';

export default function QuickActions() {
  const navigate = useNavigate();
  const { signedIn, loading } = useAccount();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const create = async () => {
    if (creating || loading) return;
    if (!signedIn) return navigate('/login?next=%2Fjoin%3Fhost%3D1');
    setCreating(true); setError('');
    try {
      const room = await apiPost('/api/rooms', {});
      if (!room?.code) throw new Error('The room could not be created. Please try again.');
      navigate(`/lobby/${room.code}`);
    } catch (e) {
      setError(e?.status ? e.message : 'Online rooms need a connection. Try again, or play a duel offline.');
      setCreating(false);
    }
  };
  return (
    <section className="hh-social-play" aria-labelledby="social-play-title">
      <div className="hh-section-heading"><h2 id="social-play-title">Better with your people</h2><span>A little competition. A lot of bakbak.</span></div>
      <div className="hh-social-play__grid">
        <button type="button" className="hh-social-action" onClick={create} disabled={creating || loading} aria-busy={creating}><span className="hh-social-action__icon"><Icon name="users" size={24} /></span><span><b>{creating ? 'Setting your table…' : 'Invite your gang'}</b><small>Create a private room & share a code</small></span><Icon name="chevR" size={19} /></button>
        <Link to="/join" className="hh-social-action"><span className="hh-social-action__icon hh-social-action__icon--gold"><Icon name="key" size={24} /></span><span><b>Got a room code?</b><small>Pull up a chair. Your friends are waiting.</small></span><Icon name="chevR" size={19} /></Link>
      </div>
      {error && <p className="hh-social-play__error" role="alert">{error} <button type="button" onClick={create}>Retry</button></p>}
    </section>
  );
}
