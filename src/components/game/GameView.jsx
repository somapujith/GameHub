// The whole game screen. Depends ONLY on the `session` interface (docs/CONTRACT.md section 6).
//   mobile: top bar, board, player strip, log drawer, action bar, chat bar (stacked)
//   >= 900px: board left, sidebar right (players, actions, log, quick chat, my properties)
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatINR } from '@shared/format.js';
import { sfx } from '@/lib/sfx.js';
import Board from './Board.jsx';
import PlayerStrip from './PlayerStrip.jsx';
import PlayerSheet from './PlayerSheet.jsx';
import ActionBar from './ActionBar.jsx';
import PropertySheet from './PropertySheet.jsx';
import AuctionSheet from './AuctionSheet.jsx';
import { LogSheet } from './LogPanel.jsx';
import EmoteBar from './EmoteBar.jsx';
import GameOverModal from './GameOverModal.jsx';
import MenuSheet from './MenuSheet.jsx';
import RulesSheet from './RulesSheet.jsx';
import MyProperties from './MyProperties.jsx';
import TradeSheet from './TradeSheet.jsx';
import DebtSheet from './DebtSheet.jsx';
import SetCelebration from './SetCelebration.jsx';
import ConfirmDialog from './ui/ConfirmDialog.jsx';
import Icon from './ui/Icon.jsx';
import Pill from './ui/Pill.jsx';
import { roundInfo, useIsWide, useReducedMotion } from './ui/helpers.js';
import '../../styles/game.css';

function TopBar({ session, onBack, onMenu }) {
  const goal = session.display?.goal ?? session.view?.cfg?.goal ?? 0;
  const r = roundInfo(session);
  return (
    <header className="hg-top">
      <button type="button" className="hg-roundbtn" onClick={onBack} aria-label="Leave game">
        <Icon name="back" size={24} strokeWidth={2.4} />
      </button>
      <div className="hg-top-mid">
        <span className="hg-table-title">HYDERABAD TYCOON <i>THE CITY IS YOURS</i></span>
        <p className="hg-goal">
          <b>{formatINR(goal)}</b> net worth to win
        </p>
        <div className="hg-round">
          <span className="hg-round-txt">
            Round {r.round}
            {r.max != null ? ` / ${r.max}` : ' · ∞'}
          </span>
          {r.final ? (
            <Pill tone="bad" pulse>Final round</Pill>
          ) : r.soon ? (
            <Pill tone="warn">{r.left} {r.left === 1 ? 'round' : 'rounds'} left</Pill>
          ) : null}
        </div>
        {r.max != null ? (
          <div
            className={`hg-roundbar${r.final ? ' is-final' : r.soon ? ' is-soon' : ''}`}
            role="progressbar"
            aria-label="Round progress"
            aria-valuemin={0}
            aria-valuemax={r.max}
            aria-valuenow={Math.min(r.round, r.max)}
          >
            <i style={{ width: `${Math.round(r.pct * 100)}%` }} />
          </div>
        ) : null}
      </div>
      <button type="button" className="hg-roundbtn" onClick={onMenu} aria-label="Menu" aria-haspopup="dialog">
        <Icon name="more" size={24} />
      </button>
    </header>
  );
}

export default function GameView({ session, onExit, rewards }) {
  const wide = useIsWide();
  const reduced = useReducedMotion();
  const [tileId, setTileId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState(false);
  const [mine, setMine] = useState(false);
  const [trade, setTrade] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const unlocked = useRef(false);

  const openTile = useCallback((id) => setTileId(id), []);
  const closeTile = useCallback(() => setTileId(null), []);
  const openMine = useCallback(() => setMine(true), []);
  const openTrade = useCallback(() => { setMine(false); setTrade(true); }, []);

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

  const board = (
    <>
      <Board session={session} onTileClick={openTile} highlightTile={tileId} />
      <SetCelebration session={session} />
    </>
  );
  const n = session.display.players?.length || 2;
  const playersAndAction = (
    <PlayerStrip session={session} onSelect={setPlayerId} action={
      <ActionBar session={session} variant="duel" onOpenUpgrades={openMine} onOpenTrade={openTrade} />
    } />
  );

  return (
    <div
      className="hg-game hg-game--minimal"
      data-mode={session.mode}
      data-wide={wide ? '' : undefined}
      data-n={n}
      data-rm={reduced ? '' : undefined}
    >
      <h1 className="hg-sr">Hyderabad Tycoon</h1>
      <TopBar session={session} onBack={() => setConfirm(true)} onMenu={() => setMenu(true)} />

      <main className="hg-playfield" aria-label="Game table">
        <div className="hg-boardwrap">{board}</div>
        <div className="hg-table-players">{playersAndAction}</div>
        {session.mode === 'online' && <EmoteBar session={session} />}
      </main>

      <PropertySheet session={session} tileId={tileId} onClose={closeTile} />
      <PlayerSheet session={session} playerId={playerId} onClose={() => setPlayerId(null)} onOpenTile={openTile} />
      <MyProperties session={session} open={mine} onClose={() => setMine(false)} onOpenTile={openTile} onOpenTrade={openTrade} />
      <TradeSheet session={session} open={trade} onClose={() => setTrade(false)} />
      <AuctionSheet session={session} />
      <DebtSheet session={session} />
      <MenuSheet
        session={session}
        open={menu}
        onClose={() => setMenu(false)}
        onRules={() => setRules(true)}
        onProperties={() => { setMenu(false); setMine(true); }}
        onLog={() => { setMenu(false); setLogOpen(true); }}
        onQuit={() => setConfirm(true)}
      />
      <LogSheet session={session} open={logOpen} onClose={() => setLogOpen(false)} />
      <RulesSheet session={session} open={rules} onClose={() => setRules(false)} />
      <ConfirmDialog
        open={confirm}
        title="Leave the game?"
        text={session.mode === 'online'
          ? 'You will leave this match.'
          : 'Your progress is saved, so you can resume it from the home screen.'}
        confirmLabel="Leave"
        cancelLabel="Keep playing"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); setMenu(false); onExit?.(); }}
      />
      <GameOverModal session={session} onExit={onExit} rewards={rewards} />
    </div>
  );
}

export { GameView };
