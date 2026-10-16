// 12 friendly, generic cartoon busts built from one shared head/shoulders template.
// Each preset only changes skin tone, hair, headwear, clothing and accessories. No real people.
import { memo, useId } from 'react';
import { PAL, darken, lighten } from './palette.js';

const INK = '#1b1340';

export const AVATAR_PRESETS = [
  { id: 0, slug: 'biryani-bhai', label: 'Biryani Bhai' },
  { id: 1, slug: 'chai-uncle', label: 'Chai Uncle' },
  { id: 2, slug: 'techie-teja', label: 'Techie Teja' },
  { id: 3, slug: 'pearl-pasha', label: 'Pearl Pasha' },
  { id: 4, slug: 'auto-anna', label: 'Auto Anna' },
  { id: 5, slug: 'mass-hero', label: 'Mass Hero' },
  { id: 6, slug: 'kirana-aunty', label: 'Kirana Aunty' },
  { id: 7, slug: 'film-producer', label: 'Film Producer' },
  { id: 8, slug: 'cricket-fan', label: 'Cricket Fan' },
  { id: 9, slug: 'coder-girl', label: 'Coder Girl' },
  { id: 10, slug: 'shopkeeper', label: 'Shopkeeper' },
  { id: 11, slug: 'netaji', label: 'Netaji' },
];

/* ---------- shared template pieces ---------- */
const SHOULDERS = 'M4 100C4 84 22 76 38 73.5H62C78 76 96 84 96 100Z';

const Neck = ({ skin }) => (
  <g>
    <path d="M42 58H58V74Q50 80 42 74Z" fill={darken(skin, 0.18)} />
    <path d="M42 62Q50 70 58 62V58H42Z" fill={darken(skin, 0.34)} opacity=".45" />
  </g>
);

const Ears = ({ skin }) => (
  <g>
    <circle cx="31.6" cy="49" r="3.9" fill={skin} />
    <circle cx="31.9" cy="49.2" r="1.7" fill={darken(skin, 0.2)} />
    <circle cx="68.4" cy="49" r="3.9" fill={skin} />
    <circle cx="68.1" cy="49.2" r="1.7" fill={darken(skin, 0.2)} />
  </g>
);

const Head = ({ skin }) => (
  <g>
    <ellipse cx="50" cy="46" rx="18.2" ry="20.6" fill={skin} />
    <path d="M32.6 50Q34 64 50 66.6Q66 64 67.4 50Q66 62 50 64.6Q34 62 32.6 50Z" fill={darken(skin, 0.12)} opacity=".6" />
  </g>
);

const Eyes = ({ lash }) => (
  <g>
    <ellipse cx="43" cy="47.4" rx="2" ry="2.6" fill={INK} />
    <ellipse cx="57" cy="47.4" rx="2" ry="2.6" fill={INK} />
    <circle cx="43.7" cy="46.4" r=".8" fill="#fff" />
    <circle cx="57.7" cy="46.4" r=".8" fill="#fff" />
    {lash && (
      <g stroke={INK} strokeWidth="1.1" strokeLinecap="round" fill="none">
        <path d="M40.4 45.6L38.8 44.6M41.2 44.6L40.4 43.2" />
        <path d="M59.6 45.6L61.2 44.6M58.8 44.6L59.6 43.2" />
      </g>
    )}
  </g>
);

const Brows = ({ c = '#2a1a14', w = 2, lift = 0 }) => (
  <g stroke={c} strokeWidth={w} strokeLinecap="round" fill="none">
    <path d={`M38.4 ${42 - lift}Q43 ${40 - lift} 47 ${41.6 - lift}`} />
    <path d={`M53 ${41.6 - lift}Q57 ${40 - lift} 61.6 ${42 - lift}`} />
  </g>
);

const Nose = ({ skin }) => <path d="M50 48.6Q47.8 54 51.4 54.6" fill="none" stroke={darken(skin, 0.3)} strokeWidth="1.3" strokeLinecap="round" />;

const Blush = () => (
  <g fill="#ff6b6b" opacity=".2">
    <circle cx="38" cy="54.6" r="3.4" />
    <circle cx="62" cy="54.6" r="3.4" />
  </g>
);

const Mouth = ({ kind = 'smile', color = INK }) => {
  if (kind === 'grin')
    return (
      <g>
        <path d="M43.4 58.6Q50 67.6 56.6 58.6Z" fill="#7a1f2e" />
        <path d="M44.6 58.6Q50 62.2 55.4 58.6Z" fill="#fff" />
      </g>
    );
  if (kind === 'smirk') return <path d="M44.4 59.6Q51 62.6 57.6 57.8" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" />;
  if (kind === 'open')
    return (
      <g>
        <path d="M44 58.4Q50 66 56 58.4Z" fill="#7a1f2e" />
        <path d="M45 58.4H55Q50 60.6 45 58.4Z" fill="#fff" />
      </g>
    );
  return <path d="M44.2 58.4Q50 63.4 55.8 58.4" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" />;
};

const Moustache = ({ c, kind = 'thick' }) => {
  if (kind === 'thin')
    return <path d="M41.4 56Q46 53.4 50 55.4Q54 53.4 58.6 56Q54 55.8 50 57.2Q46 55.8 41.4 56Z" fill={c} />;
  if (kind === 'handlebar')
    return (
      <g fill={c}>
        <path d="M50 55.6Q44 51.6 38.6 55.4Q36.4 57.2 37.4 59.6Q38.6 57.4 41.2 57.4Q46 57.6 50 58Q54 57.6 58.8 57.4Q61.4 57.4 62.6 59.6Q63.6 57.2 61.4 55.4Q56 51.6 50 55.6Z" />
      </g>
    );
  return <path d="M39.6 56.6Q44 51.6 50 55Q56 51.6 60.4 56.6Q56 59.8 50 57.2Q44 59.8 39.6 56.6Z" fill={c} />;
};

const FULL_BEARD = 'M32 49C31 67 38 76 50 76C62 76 69 67 68 49C66.4 56.4 62.4 58.6 57 58C54 56.4 46 56.4 43 58C37.6 58.6 33.6 56.4 32 49Z';
const STUBBLE = 'M32.4 51C33.2 62 40 66.2 50 66.6C60 66.2 66.8 62 67.6 51C65.4 57.6 61 59.4 56.6 58.8Q50 57 43.4 58.8C39 59.4 34.6 57.6 32.4 51Z';
const Beard = ({ c, kind = 'full' }) =>
  kind === 'stubble' ? (
    <path d={STUBBLE} fill={c} opacity=".3" />
  ) : (
    <path d={FULL_BEARD} fill={c} />
  );

/* ---------- hair ---------- */
const HAIR_SHORT = 'M31.4 46C28.4 28 39 19 50 19C61 19 71.6 28 68.6 46C66.6 37.6 61 32.4 50 32.4C39 32.4 33.4 37.6 31.4 46Z';
const HAIR_SIDE = 'M31.4 46C28 27 40 18.4 52 18.8C64 19.2 72 28 68.6 46C67.4 38.4 62.6 30.4 51 30.4C43.4 30.4 37.4 33.4 31.4 46Z';
const HAIR_QUIFF = 'M30.6 47C26 25 37 10.4 52 11.6C66 12.8 74.6 26 69.4 47C67.6 37 62 28.6 50 28.6C40 28.6 33.6 35 30.6 47Z';
const SIDE_TUFTS = 'M32 45Q29.4 39 32.4 33.6L36 36Q33.6 40.4 35 46ZM68 45Q70.6 39 67.6 33.6L64 36Q66.4 40.4 65 46Z';

const Sideburns = ({ c }) => <path d="M32.2 47Q30.4 40 33.4 35L36.6 37.4Q34.6 41 35.4 48ZM67.8 47Q69.6 40 66.6 35L63.4 37.4Q65.4 41 64.6 48Z" fill={c} />;

/* ---------- glasses ---------- */
const GlassesRect = ({ c = INK }) => (
  <g fill="#fff" fillOpacity=".3" stroke={c} strokeWidth="1.7" strokeLinejoin="round">
    <rect x="36.2" y="42.4" width="13" height="10" rx="3.2" />
    <rect x="50.8" y="42.4" width="13" height="10" rx="3.2" />
    <path d="M49.2 46.6Q50 45.6 50.8 46.6" fill="none" />
    <path d="M36.2 46L32.4 45M63.8 46L67.6 45" fill="none" />
  </g>
);
const GlassesRound = ({ c = '#c98a1a' }) => (
  <g fill="#fff" fillOpacity=".28" stroke={c} strokeWidth="1.4">
    <circle cx="43" cy="48" r="5.6" />
    <circle cx="57" cy="48" r="5.6" />
    <path d="M48.6 47.4Q50 46 51.4 47.4" fill="none" />
    <path d="M37.4 47L33.4 46M62.6 47L66.6 46" fill="none" />
  </g>
);
const Sunglasses = () => (
  <g>
    <path d="M35 43H49.4V50Q49.4 53.4 45.6 53.4H39Q35 53.4 35 50Z" fill={INK} />
    <path d="M50.6 43H65V50Q65 53.4 61 53.4H54.4Q50.6 53.4 50.6 50Z" fill={INK} />
    <path d="M49.2 44.4H50.8M35 44.4L32.4 44M65 44.4L67.6 44" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M37.6 44.8L42.4 44.8L38.6 49Z" fill="#fff" opacity=".55" />
    <path d="M53.2 44.8L58 44.8L54.2 49Z" fill="#fff" opacity=".55" />
    <path d="M35 43H49.4M50.6 43H65" stroke={PAL.gold} strokeWidth="1" />
  </g>
);

/* ---------- presets ---------- */
function Layers({ i }) {
  switch (i) {
    case 0: {
      // Biryani Bhai: chef toque, beard, grin, white coat + red scarf
      const skin = '#d99a62';
      return (
        <>
          <path d={SHOULDERS} fill="#fffaf0" />
          <path d="M50 79V100" stroke="#e4dccb" strokeWidth="1.4" />
          {[84, 92].map((y) => [44, 56].map((x) => <circle key={x + '' + y} cx={x} cy={y} r="1.6" fill={PAL.gold} />))}
          <Neck skin={skin} />
          <path d="M40.6 73.6H59.4L50 88Z" fill="#e5484d" />
          <path d="M44 74.4H56L50 82Z" fill="#ff7a88" />
          <Ears skin={skin} />
          <Head skin={skin} />
          <Blush />
          <Eyes />
          <Brows c="#2a1a14" w={2.4} />
          <Nose skin={skin} />
          <Beard c="#2a1a14" />
          <Moustache c="#2a1a14" kind="thick" />
          <Mouth kind="grin" />
          <Sideburns c="#2a1a14" />
          {/* chef toque */}
          <g fill="#e6dff2"><circle cx="37.6" cy="20.4" r="9" /><circle cx="50" cy="15.4" r="11" /><circle cx="62.4" cy="20.4" r="9" /></g>
          <g fill="#fff"><circle cx="37.6" cy="18.6" r="9" /><circle cx="50" cy="13.4" r="11" /><circle cx="62.4" cy="18.6" r="9" /><rect x="35" y="19" width="30" height="12" /></g>
          <path d="M33.4 36Q33 28.4 35.6 26H64.4Q67 28.4 66.6 36Q50 31.6 33.4 36Z" fill="#fff" />
          <path d="M33.4 36Q50 31.6 66.6 36" fill="none" stroke="#d9d0e8" strokeWidth="1.6" />
          <path d="M42 24V31M50 22V30M58 24V31" stroke="#e6dff2" strokeWidth="1.3" strokeLinecap="round" />
        </>
      );
    }
    case 1: {
      // Chai Uncle: flat cap, grey handlebar moustache, mustard cardigan
      const skin = '#c68642';
      return (
        <>
          <path d={SHOULDERS} fill="#d98e2b" />
          <path d="M38 74L50 90L62 74L58 73.6L50 83L42 73.6Z" fill="#fff7e6" />
          <path d="M42 74.6L50 86L58 74.6L50 80Z" fill={darken(skin, 0.15)} />
          <path d="M50 88V100" stroke="#b9741a" strokeWidth="1.4" />
          {[92, 97].map((y) => <circle key={y} cx="50" cy={y} r="1.4" fill="#fff7e6" />)}
          <Neck skin={skin} />
          <Ears skin={skin} />
          <Head skin={skin} />
          <Blush />
          <Eyes />
          <g stroke={darken(skin, 0.3)} strokeWidth=".9" strokeLinecap="round" fill="none"><path d="M37.6 50.4L36.2 51.2M62.4 50.4L63.8 51.2M38.4 52L37 53.2M61.6 52L63 53.2" /></g>
          <Brows c="#d6d0e6" w={2.6} />
          <Nose skin={skin} />
          <Mouth kind="smile" />
          <Moustache c="#d6d0e6" kind="handlebar" />
          <path d="M32.4 45Q30.4 40 33 36.4L36 38.6Q34 41.6 35 46Z" fill="#d6d0e6" />
          <path d="M67.6 45Q69.6 40 67 36.4L64 38.6Q66 41.6 65 46Z" fill="#d6d0e6" />
          <path d="M30 37.4C29 25 40 19 52 20C64 21 71 28 70 37.4C60 33 40 33 30 37.4Z" fill="#7a4a32" />
          <path d="M34 30C38 24 46 22 52 22C46 25 40 28 36 33Z" fill="#946045" />
          <path d="M52 35C60 33 72 34 78 39.6C68 41.6 58 40.4 52 37.4Z" fill="#5a3524" />
          <circle cx="51" cy="20.6" r="2" fill="#5a3524" />
        </>
      );
    }
    case 2: {
      // Techie Teja: glasses, lanyard + ID badge, indigo hoodie
      const skin = '#e0ac7b';
      return (
        <>
          <path d="M26 80C23 66 30 59.6 38 58H62C70 59.6 77 66 74 80Z" fill="#2a2068" />
          <path d={SHOULDERS} fill="#3a2f8c" />
          <path d="M38 73.6Q50 82 62 73.6L62 78Q50 86 38 78Z" fill="#2e2475" />
          <Neck skin={skin} />
          <path d="M44.6 78V88M55.4 78V88" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M39.6 74Q42 90 49 99M60.4 74Q58 90 51 99" fill="none" stroke={PAL.teal} strokeWidth="2.4" strokeLinecap="round" />
          <rect x="43" y="88" width="14" height="16" rx="2.4" fill="#fff" />
          <rect x="43" y="88" width="14" height="4" rx="1.6" fill={PAL.teal} />
          <circle cx="50" cy="96" r="2.8" fill="#e0ac7b" />
          <rect x="45.4" y="100" width="9.2" height="1.4" rx=".7" fill="#8c84c8" />
          <Ears skin={skin} />
          <Head skin={skin} />
          <Blush />
          <Eyes />
          <Brows c={INK} w={2.2} />
          <Nose skin={skin} />
          <Mouth kind="smile" />
          <GlassesRect c={INK} />
          <path d={HAIR_SIDE} fill={INK} />
          <path d="M38 27C44 22 54 22 62 27" fill="none" stroke="#3a2f8c" strokeWidth="1.8" strokeLinecap="round" opacity=".7" />
        </>
      );
    }
    case 3: {
      // Pearl Pasha: turban + brooch, sherwani with gold buttons, pearls
      const skin = '#b97a45';
      return (
        <>
          <path d={SHOULDERS} fill="#8a1c3a" />
          <path d="M50 80V100" stroke={PAL.gold} strokeWidth="1.6" />
          {[84, 90, 96].map((y) => <circle key={y} cx="50" cy={y} r="1.7" fill={PAL.gold} />)}
          <Neck skin={skin} />
          <path d="M39 73.4Q50 81 61 73.4V79Q50 86.6 39 79Z" fill="#6f1630" />
          <path d="M39 79Q50 86.6 61 79" fill="none" stroke={PAL.gold} strokeWidth="1.3" />
          {Array.from({ length: 9 }, (_, k) => {
            const t = k / 8;
            const x = 35 + t * 30;
            const y = 78 + Math.sin(t * Math.PI) * 14;
            return <circle key={k} cx={x} cy={y} r="2.1" fill="#fff" stroke="#d9d2ee" strokeWidth=".6" />;
          })}
          <Ears skin={skin} />
          <Head skin={skin} />
          <Blush />
          <Eyes />
          <Brows c={INK} w={2.4} />
          <Nose skin={skin} />
          <Beard c={INK} />
          <Moustache c={INK} kind="handlebar" />
          <Mouth kind="smile" color="#fff" />
          <path d="M30.4 38C27 22 38 11 50 11C62 11 73 22 69.6 38C61 32 39 32 30.4 38Z" fill="#fff2d0" />
          <path d="M31 31Q50 20 69 31M30.6 35Q50 25 69.4 35M34 24Q50 15 66 24" fill="none" stroke="#e8cf94" strokeWidth="2" strokeLinecap="round" />
          <path d="M30.4 38Q50 32 69.6 38" fill="none" stroke={PAL.gold} strokeWidth="3" />
          <path d="M50 28Q56 20 62 12Q56 18 52 24Z" fill={PAL.teal} />
          <circle cx="50" cy="31" r="3.8" fill={PAL.gold} />
          <circle cx="50" cy="31" r="2.2" fill="#e5484d" />
        </>
      );
    }
    case 4: {
      // Auto Anna: khaki shirt, gamcha towel, messy hair, thin moustache
      const skin = '#a9683a';
      return (
        <>
          <path d={SHOULDERS} fill="#c9ab6b" />
          <path d="M38 73.6L50 86L62 73.6L58 73L50 79L42 73Z" fill="#8f7640" />
          <path d="M36 74L46 80L40 88L30 80Z" fill="#ddc58a" />
          <path d="M64 74L54 80L60 88L70 80Z" fill="#ddc58a" />
          <rect x="60" y="88" width="10" height="9" rx="1.2" fill="#b9985a" />
          <path d="M60 91H70" stroke="#8f7640" strokeWidth=".8" />
          <path d="M50 86V100" stroke="#a88a50" strokeWidth="1.2" />
          <Neck skin={skin} />
          <path d="M5 92L24 76L38 83L20 100Z" fill="#e5484d" />
          <path d="M9 92L25 79M12 96L28 82M16 99L31 86" stroke="#fff" strokeWidth="1.3" opacity=".8" />
          <Ears skin={skin} />
          <Head skin={skin} />
          <Blush />
          <Eyes />
          <Brows c={INK} w={2.3} />
          <Nose skin={skin} />
          <Beard c={INK} kind="stubble" />
          <Moustache c={INK} kind="thin" />
          <Mouth kind="smile" />
          <path d="M31.2 46C28 30 38 18 51 18.4C63 19 71.6 28 68.8 46C67 38.4 62 31.6 50 31.6C40 31.6 34 36 31.2 46Z" fill={INK} />
          <path d="M36 24L33 17L42 21L44 14L50 20L56 13L58 21L66 17L63 25" fill={INK} />
        </>
      );
    }
    case 5: {
      // Mass Hero: sunglasses, big quiff, open collar + gold chain
      const skin = '#d9a066';
      return (
        <>
          <path d={SHOULDERS} fill="#241b5c" />
          <path d="M39 73.6L50 92L61 73.6Q50 79 39 73.6Z" fill={darken(skin, 0.1)} />
          <path d="M36 74L47 84L42 92L30 80Z" fill="#32277a" />
          <path d="M64 74L53 84L58 92L70 80Z" fill="#32277a" />
          <Neck skin={skin} />
          <path d="M40.4 75.6Q50 92 59.6 75.6" fill="none" stroke={PAL.gold} strokeWidth="2" strokeLinecap="round" />
          <circle cx="50" cy="86.4" r="2.6" fill={PAL.gold} />
          <Ears skin={skin} />
          <Head skin={skin} />
          <Blush />
          <Brows c={INK} w={2.6} lift={1.2} />
          <Nose skin={skin} />
          <Beard c={INK} kind="stubble" />
          <Mouth kind="smirk" />
          <Sunglasses />
          <path d={HAIR_QUIFF} fill={INK} />
          <path d="M40 22C46 14 58 14 64 21" fill="none" stroke="#4a3fb0" strokeWidth="2.2" strokeLinecap="round" opacity=".8" />
        </>
      );
    }
    case 6: {
      // Kirana Aunty: bindi, bun with gajra, jhumkas, saree
      const skin = '#d08a58';
      return (
        <>
          <path d={SHOULDERS} fill="#7c3aed" />
          <path d="M8 90C20 76 34 72 46 75L38 100H6Z" fill="#5b21b6" />
          <path d="M10 88C22 75 36 71.4 47 74.6" fill="none" stroke={PAL.gold} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M34 74Q50 86 66 74L62 73.6Q50 80 38 73.6Z" fill="#e6c07a" opacity=".9" />
          <Neck skin={skin} />
          <path d="M40 75Q50 90 60 75" fill="none" stroke="#2a1a14" strokeWidth="1.6" strokeDasharray="1.2 1.6" strokeLinecap="round" />
          <circle cx="50" cy="83.6" r="2.2" fill={PAL.gold} />
          <Ears skin={skin} />
          <Head skin={skin} />
          <Blush />
          <Eyes lash />
          <Brows c="#2a1a14" w={1.9} />
          <Nose skin={skin} />
          <Mouth kind="smile" color="#c0264a" />
          <path d={HAIR_SHORT.replace('M31.4 46', 'M31.4 45')} fill="#241320" />
          <path d="M36 35C42 28 58 28 64 35" fill="none" stroke="#4a2f45" strokeWidth="1.6" strokeLinecap="round" opacity=".6" />
          <circle cx="50" cy="14.6" r="8.6" fill="#241320" />
          <circle cx="46.6" cy="12" r="3" fill="#4a2f45" opacity=".8" />
          <g fill="#fff">{[38, 43, 48, 53, 58, 63].map((x, k) => <circle key={x} cx={x} cy={20.6 - Math.sin((k / 5) * Math.PI) * 3.2 + 3.2} r="2.2" />)}</g>
          <circle cx="50" cy="38.2" r="2" fill="#e5484d" />
          <g fill={PAL.gold}><circle cx="31.6" cy="55" r="1.7" /><path d="M30.4 56.4L32.8 56.4L31.6 60.4Z" /><circle cx="68.4" cy="55" r="1.7" /><path d="M67.2 56.4L69.6 56.4L68.4 60.4Z" /></g>
        </>
      );
    }
    case 7: {
      // Film Producer: panama hat, thick moustache, purple blazer + bow tie
      const skin = '#e0ac7b';
      return (
        <>
          <path d={SHOULDERS} fill="#5b3fb0" />
          <path d="M40 73.6L50 96L60 73.6L56 73L50 84L44 73Z" fill="#fff" />
          <path d="M34 74L46 86L40 98L28 80Z" fill="#46309a" />
          <path d="M66 74L54 86L60 98L72 80Z" fill="#46309a" />
          <path d="M38 78L36 100M62 78L64 100" stroke="#46309a" strokeWidth="0" />
          <Neck skin={skin} />
          <path d="M42.6 78L50 80.6L42.6 84ZM57.4 78L50 80.6L57.4 84Z" fill={PAL.rose} />
          <circle cx="50" cy="80.6" r="1.8" fill="#c0264a" />
          <path d="M60 84h5v3.6h-5Z" fill="#fff" />
          <path d="M60 84h5l-1 -2z" fill={PAL.rose} />
          <Ears skin={skin} />
          <Head skin={skin} />
          <Blush />
          <Eyes />
          <Brows c="#6b6485" w={2.4} />
          <Nose skin={skin} />
          <Mouth kind="smile" />
          <Moustache c="#6b6485" kind="thick" />
          <path d="M32 46Q30 41 32.4 36L36 38.4Q34 42 35 47Z M68 46Q70 41 67.6 36L64 38.4Q66 42 65 47Z" fill="#6b6485" />
          <ellipse cx="50" cy="34.4" rx="29" ry="7.4" fill="#e6cf92" />
          <path d="M34.6 33C34 18 43 13 50 13C57 13 66 18 65.4 33C58 30.4 42 30.4 34.6 33Z" fill="#f4e2ab" />
          <path d="M34.6 33C42 30.4 58 30.4 65.4 33L65.6 28.6C58 26 42 26 34.4 28.6Z" fill="#3a2f8c" />
          <path d="M22 35Q50 42 78 35Q70 41 50 42Q30 41 22 35Z" fill="#cdb677" />
        </>
      );
    }
    case 8: {
      // Cricket Fan: blue cap, tricolour face paint, blue jersey
      const skin = '#d9a066';
      return (
        <>
          <path d={SHOULDERS} fill="#2f6fe0" />
          <path d="M38 73.6L50 88L62 73.6Q50 79 38 73.6Z" fill={darken(skin, 0.12)} />
          <path d="M36 74L47 84L40 88L30 78Z" fill={PAL.saffron} />
          <path d="M64 74L53 84L60 88L70 78Z" fill={PAL.saffron} />
          <path d="M4 96H14M86 96H96" stroke="#fff" strokeWidth="3" />
          <Neck skin={skin} />
          <Ears skin={skin} />
          <Head skin={skin} />
          <Blush />
          <Eyes />
          <Brows c="#2a1a14" w={2.3} lift={0.6} />
          <Nose skin={skin} />
          <Mouth kind="open" />
          <g>
            <rect x="34" y="52" width="8" height="1.9" rx=".9" fill={PAL.saffron} />
            <rect x="34" y="54.4" width="8" height="1.9" rx=".9" fill="#fff" />
            <rect x="34" y="56.8" width="8" height="1.9" rx=".9" fill="#1fa35a" />
            <rect x="58" y="52" width="8" height="1.9" rx=".9" fill={PAL.saffron} />
            <rect x="58" y="54.4" width="8" height="1.9" rx=".9" fill="#fff" />
            <rect x="58" y="56.8" width="8" height="1.9" rx=".9" fill="#1fa35a" />
          </g>
          <path d="M32 44Q30.6 38.6 33.6 35L36.4 37.4Q34.4 40.6 35 45Z M68 44Q69.4 38.6 66.4 35L63.6 37.4Q65.6 40.6 65 45Z" fill={INK} />
          <path d="M30.6 38C29.6 24 40 17.6 50 17.6C60 17.6 70.4 24 69.4 38C60 34 40 34 30.6 38Z" fill="#1f4fc0" />
          <path d="M34 28C38 22 46 20 52 20C46 23 40 27 37 33Z" fill="#3b73e8" />
          <path d="M36 37C44 35 62 35 73 40Q76 43.6 66 43.4Q50 40.4 36 40Z" fill="#163d99" />
          <circle cx="50" cy="17.8" r="1.8" fill="#163d99" />
          <circle cx="50" cy="27.4" r="3.2" fill="#fff" />
          <path d="M48.2 26.4Q50 28 51.8 26.4" fill="none" stroke="#e5484d" strokeWidth=".8" />
        </>
      );
    }
    case 9: {
      // Coder Girl: headphones, long hair with teal streak, violet hoodie, </> logo
      const skin = '#f0c29a';
      return (
        <>
          <path d="M29 46C24 64 26 78 30 86H70C74 78 76 64 71 46Z" fill="#3b1d2a" />
          <path d="M26 84C24 70 30 60 38 58" fill="none" stroke={PAL.teal} strokeWidth="3" strokeLinecap="round" opacity=".9" />
          <path d={SHOULDERS} fill="#6d28d9" />
          <path d="M38 73.6Q50 82 62 73.6L62 78Q50 86 38 78Z" fill="#5b21b6" />
          <path d="M44.6 79V88M55.4 79V88" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M43 92L39.6 95L43 98M57 92L60.4 95L57 98M52 91L48 99" fill="none" stroke="#e9ddff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <Neck skin={skin} />
          <Ears skin={skin} />
          <Head skin={skin} />
          <Blush />
          <Eyes lash />
          <Brows c="#3b1d2a" w={1.9} />
          <Nose skin={skin} />
          <Mouth kind="smile" color="#c0264a" />
          <GlassesRound c="#f472b6" />
          <path d="M31 46C28 28 39 18.6 50 18.6C61 18.6 72 28 69 46C68 37 61 31 52 31C44 31 38 35 31 46Z" fill="#3b1d2a" />
          <path d="M36 28C42 23 52 21 62 25" fill="none" stroke="#5c3347" strokeWidth="2" strokeLinecap="round" />
          <path d="M33 40C34 34 38 31 43 30" fill="none" stroke={PAL.teal} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M31 50V43Q31 18 50 18Q69 18 69 43V50" fill="none" stroke="#1b1340" strokeWidth="3.6" strokeLinecap="round" />
          <rect x="26.4" y="43" width="7" height="13" rx="3.2" fill="#1b1340" />
          <rect x="66.6" y="43" width="7" height="13" rx="3.2" fill="#1b1340" />
          <rect x="27.4" y="46" width="3" height="7" rx="1.5" fill={PAL.teal} />
          <rect x="69.6" y="46" width="3" height="7" rx="1.5" fill={PAL.teal} />
        </>
      );
    }
    case 10: {
      // Shopkeeper: round glasses, tilak, bald with side hair, teal apron
      const skin = '#c68642';
      return (
        <>
          <path d={SHOULDERS} fill="#f7f2ff" />
          <path d="M34 77H66L64 100H36Z" fill="#2a9d8f" />
          <path d="M36 77L40 73.6M64 77L60 73.6" stroke="#2a9d8f" strokeWidth="3.2" strokeLinecap="round" />
          <rect x="43" y="88" width="14" height="9" rx="1.6" fill="#1f7a70" />
          <path d="M43 91H57" stroke="#2a9d8f" strokeWidth="1" />
          <path d="M39 73.6L50 82L61 73.6L57 73L50 78L43 73Z" fill="#fff" stroke="#d9d0e8" strokeWidth=".8" />
          <Neck skin={skin} />
          <Ears skin={skin} />
          <Head skin={skin} />
          <ellipse cx="45" cy="30" rx="6" ry="2.4" fill="#fff" opacity=".28" transform="rotate(-14 45 30)" />
          <Blush />
          <Eyes />
          <Brows c="#d6d0e6" w={2.4} />
          <Nose skin={skin} />
          <Mouth kind="smile" />
          <Moustache c="#d6d0e6" kind="thick" />
          <GlassesRound c="#c98a1a" />
          <path d={SIDE_TUFTS} fill="#d6d0e6" />
          <path d="M50 32.4V39.4" stroke="#e5484d" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M45.4 33.6Q50 30.6 54.6 33.6" fill="none" stroke={PAL.saffron} strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
    }
    default: {
      // 11 Netaji: white kurta + tricolour shawl, white topi, grey moustache
      const skin = '#b9783f';
      return (
        <>
          <path d={SHOULDERS} fill="#fbf8ff" />
          <path d="M50 80V100" stroke="#d9d0e8" strokeWidth="1.2" />
          {[86, 92, 98].map((y) => <circle key={y} cx="50" cy={y} r="1.3" fill="#c9c0e0" />)}
          <path d="M39 73.4Q50 80 61 73.4V78Q50 84.6 39 78Z" fill="#efeaf8" />
          <Neck skin={skin} />
          <path d="M39 73.4Q50 80 61 73.4" fill="none" stroke="#d9d0e8" strokeWidth="1" />
          <path d="M10 100L16 82C26 74 36 72.4 44 74.6L36 100Z" fill="#fff" />
          <path d="M12.6 92L16.6 81C26 73.6 35 72 43 73.8L44 74.8C35 73 27 75 18.6 83L15 92Z" fill={PAL.saffron} />
          <path d="M26 100L36 100L41 86C34 87 29 91 26 100Z" fill="#1fa35a" />
          <Ears skin={skin} />
          <Head skin={skin} />
          <Blush />
          <Eyes />
          <Brows c="#d6d0e6" w={2.6} />
          <Nose skin={skin} />
          <Mouth kind="smile" />
          <Moustache c="#d6d0e6" kind="thick" />
          <path d="M32 46Q30.4 41 32.6 37L36 39Q34.2 42.4 35 47Z M68 46Q69.6 41 67.4 37L64 39Q65.8 42.4 65 47Z" fill="#d6d0e6" />
          <path d="M29.6 40L36 22C44 17.4 56 17.4 64 22L70.4 40C60 35.4 40 35.4 29.6 40Z" fill="#fff" />
          <path d="M29.6 40C40 35.4 60 35.4 70.4 40L69.8 36.6C60 32.4 40 32.4 30.2 36.6Z" fill="#ece6f7" />
          <path d="M36 22C44 17.4 56 17.4 64 22" fill="none" stroke="#d9d0e8" strokeWidth="1.2" />
        </>
      );
    }
  }
}

const BG = [
  ['#ff8a3d', '#ffb072'],
  ['#2ec4b6', '#7fe3d8'],
  ['#4cc9f0', '#9be3f8'],
  ['#9b7bff', '#c4b0ff'],
  ['#2fa86a', '#6fd39a'],
  ['#ff5d73', '#ff95a3'],
  ['#f472b6', '#f9a8d4'],
  ['#3a2f8c', '#6b5fd0'],
  ['#ffd23f', '#ffe58a'],
  ['#9bd83a', '#c5ee78'],
  ['#e07a5f', '#f0a78f'],
  ['#0f766e', '#2fb3a8'],
];

function AvatarBase({ preset = 0, size = 48, ring, className, title }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const n = Number.isFinite(+preset) ? ((Math.trunc(+preset) % 12) + 12) % 12 : 0;
  const [bg, bg2] = BG[n];
  const ringColor = ring === true ? PAL.gold : ring || null;
  const r = ringColor ? 45.4 : 50;
  const label = title === undefined ? undefined : title || AVATAR_PRESETS[n].label;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={{ flex: 'none', verticalAlign: 'middle' }}
    >
      <defs>
        <clipPath id={uid + 'c'}>
          <circle cx="50" cy="50" r={r} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}c)`}>
        <rect width="100" height="100" fill={bg} />
        <circle cx="26" cy="22" r="40" fill={bg2} opacity=".55" />
        <Layers i={n} />
      </g>
      {ringColor && <circle cx="50" cy="50" r="47.4" fill="none" stroke={ringColor} strokeWidth="5.2" />}
      {ringColor && <circle cx="50" cy="50" r="44.6" fill="none" stroke="#1b1340" strokeOpacity=".25" strokeWidth="1" />}
    </svg>
  );
}

export const Avatar = memo(AvatarBase);
export default Avatar;
void lighten;
