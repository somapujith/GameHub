import { CoinIcon } from '@/components/shell/icons.jsx';
import { fmtNum } from '@/components/shell/ui.jsx';
import { useProfile } from '@/components/shell/stores.js';
import { useAccount } from '@/components/shell/hooks.js';

/** Soft-currency balance: the server value for a signed-in player, else the on-device profile. */
export default function CoinsChip() {
  const [profile] = useProfile();
  const { user } = useAccount();
  const serverCoins = Number(user?.coins);
  const coins = user && Number.isFinite(serverCoins) ? serverCoins : profile.coins;
  return (
    <span className="hub-coins" title="Your coins">
      <CoinIcon size={18} />
      <b>{fmtNum(coins)}</b>
      <span className="hub-sr"> coins</span>
    </span>
  );
}
