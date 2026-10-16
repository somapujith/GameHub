// Brief banner + confetti when the LOCAL player completes a colour set (buy, auction or trade).
// Detected from the animated board ownership, so it lands together with the board animation.
// Mounted inside .hg-boardwrap; never blocks taps.
import { useEffect, useRef, useState } from 'react';
import Confetti from './ui/Confetti.jsx';
import Icon from './ui/Icon.jsx';
import { SET_GROUPS, useStateLike } from './ui/helpers.js';

const SHOW_MS = 3600;
const PROP_SETS = SET_GROUPS.filter((s) => s.kind === 'property');

export default function SetCelebration({ session }) {
  const state = useStateLike(session);
  const me = session.me;
  const prev = useRef(null);
  const timer = useRef(0);
  const [banner, setBanner] = useState(null); // { key, set }

  useEffect(() => {
    const full = new Set(PROP_SETS.filter((s) => s.tiles.every((t) => state.owners[t] === me)).map((s) => s.id));
    if (prev.current === null) { prev.current = full; return; } // first render (resume): no celebration
    const fresh = PROP_SETS.find((s) => full.has(s.id) && !prev.current.has(s.id));
    prev.current = full;
    if (!fresh) return;
    setBanner({ key: Date.now(), set: fresh });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setBanner(null), SHOW_MS);
  }, [state.owners, me]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="hg-celebrate" role="status" aria-live="polite">
      {banner ? (
        <div key={banner.key} className="hg-celebrate-in">
          <Confetti count={34} loop={false} />
          <div className="hg-celebrate-card" style={{ '--sc': banner.set.color }}>
            <span className="hg-celebrate-ico"><Icon name="spark" size={22} /></span>
            <div>
              <b>Colour set complete!</b>
              <span>{banner.set.name}: rent {'×'}2 on empty plots, you can build now</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
