// The whole game screen. Depends ONLY on the `session` interface (docs/CONTRACT.md section 6).
// Laid out like the classic table game:
//   >= 900px: [ square board (control panel in its centre) | scoreboard column (money bar, chat) ]
//   mobile:   slim top bar, board at full width, scoreboard as a compact list underneath, chat
import { useCallback, useEffect, useRef, useState } from 'react';
import { TILES } from '@shared/board.js';
import { formatINR } from '@shared/format.js';
import { sfx } from '@/lib/sfx.js';
import Board from './Board.jsx';
import ControlPanel from './ControlPanel.jsx';
import MoneyBar, { snatchWindow } from './MoneyBar.jsx';
import PlayerSheet, { StatsSheet } from './PlayerSheet.jsx';
import PropertySheet from './PropertySheet.jsx';
import AuctionSheet from './AuctionSheet.jsx';
import { LogSheet } from './LogPanel.jsx';
import EmoteBar from './EmoteBar.jsx';
import GameOverModal from './GameOverModal.jsx';
import MenuSheet from './MenuSheet.jsx';
import RulesSheet from './RulesSheet.jsx';
import TradeSheet from './TradeSheet.jsx';
import DebtSheet from './DebtSheet.jsx';
import SetCelebration from './SetCelebration.jsx';
import ConfirmDialog from './ui/ConfirmDialog.jsx';
import Icon from './ui/Icon.jsx';
import Pill from './ui/Pill.jsx';
import { nameOf, roundInfo, useIsWide, useReducedMotion } from './ui/helpers.js';
import '../../styles/game.css';

function TopBar({ session, onBack, onMenu }) {
  const goal = session.display?.goal ?? session.view?.cfg?.goal ?? 0;
  const r = roundInfo(session);
  return (
    <header className="hg-top">
      <button type="button" className="hg-roundbtn" onClick={onBack} aria-label="Leave game">
        <Icon name="back" size={22} strokeWidth={2.4} />
      </button>
      <div className="hg-top-mid">
        <span className="hg-table-title">HYDERABAD TYCOON</span>
        <p className="hg-goal">
          <span>Win at <b>{formatINR(goal)}</b> net worth</span>
          <span className="hg-goal-sep" aria-hidden="true">&middot;</span>
          <span className="hg-round-txt">
            Round {r.round}
            {r.max != null ? `/${r.max}` : ' · ∞'}
          </span>
          {r.final ? (
            <Pill tone="bad" pulse>Final round</Pill>
          ) : r.soon ? (
            <Pill tone="warn">{r.left} {r.left === 1 ? 'round' : 'rounds'} left</Pill>
          ) : null}
        </p>
      </div>
      <button type="button" className="hg-roundbtn" onClick={onMenu} aria-label="Menu" aria-haspopup="dialog">
        <Icon name="more" size={22} />
      </button>
    </header>
  );
}

export default function GameView({ session, onExit }) {
  const wide = useIsWide();
  const reduced = useReducedMotion();
  const [tileId, setTileId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState(false);
  const [stats, setStats] = useState(false);
  const [trade, setTrade] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const unlocked = useRef(false);

  const openTile = useCallback((id) => setTileId(id), []);
  const closeTile = useCallback(() => setTileId(null), []);
  const openTrade = useCallback(() => setTrade(true), []);
  const openStats = useCallback(() => setStats(true), []);

  /* WebAudio needs a user gesture */
  useEffect(() => {
    const unlock = () => {
      if (unlocked.current) return;
      unlocked.current = true;
      try { sfx.unlock?.(); } catch { /* optional */ }
    };
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
  }, []);

  if (!session?.view || !session?.display) {
    return (
      <div className="hg-game hg-game--loading" role="status">
        <p>Loading game&hellip;</p>
      </div>
    );
  }

  /* Screen readers: say it when a snatch window opens (from the live state, not the delayed display) */
  const snatching = snatchWindow(session);
  const snatchNote = snatching
    ? `${nameOf(session, snatching.buyer)} bought ${TILES[snatching.tile]?.name || 'a property'}, snatch window open`
    : '';

  return (
    <div
      className="hg-game"
      data-wide={wide ? '' : undefined}
      data-rm={reduced ? '' : undefined}
    >
      <h1 className="hg-sr">Hyderabad Tycoon</h1>
      <p className="hg-sr" role="status" aria-live="polite" aria-atomic="true">{snatchNote}</p>
      <TopBar session={session} onBack={() => setConfirm(true)} onMenu={() => setMenu(true)} />

      <main className="hg-table" aria-label="Game table">
        <div className="hg-boardcol">
          <div className="hg-boardwrap">
            <Board
              session={session}
              onTileClick={openTile}
              highlightTile={tileId}
              center={<ControlPanel session={session} onOpenTile={openTile} onOpenTrade={openTrade} />}
            />
            <SetCelebration session={session} />
          </div>
        </div>
        <aside className="hg-side" aria-label="Scoreboard">
          <MoneyBar session={session} onSelect={setPlayerId} onOpenStats={openStats} compact={!wide} />
          <div className="hg-chatcard"><EmoteBar session={session} /></div>
        </aside>
      </main>

      <PropertySheet session={session} tileId={tileId} onClose={closeTile} />
      <PlayerSheet session={session} playerId={playerId} onClose={() => setPlayerId(null)} onOpenTile={openTile} />
      <StatsSheet session={session} open={stats} onClose={() => setStats(false)} onOpenTile={openTile} />
      <TradeSheet session={session} open={trade} onClose={() => setTrade(false)} />
      <AuctionSheet session={session} />
      <DebtSheet session={session} />
      <MenuSheet
        session={session}
        open={menu}
        onClose={() => setMenu(false)}
        onRules={() => setRules(true)}
        onStats={() => { setMenu(false); setStats(true); }}
        onLog={() => { setMenu(false); setLogOpen(true); }}
        onQuit={() => setConfirm(true)}
      />
      <LogSheet session={session} open={logOpen} onClose={() => setLogOpen(false)} />
      <RulesSheet session={session} open={rules} onClose={() => setRules(false)} />
      <ConfirmDialog
        open={confirm}
        title="Leave the game?"
        text="You will leave this match."
        confirmLabel="Leave"
        cancelLabel="Keep playing"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); setMenu(false); onExit?.(); }}
      />
      <GameOverModal session={session} onExit={onExit} />
    </div>
  );
}

export { GameView };
