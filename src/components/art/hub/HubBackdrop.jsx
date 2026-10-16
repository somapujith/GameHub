// Calm full-bleed backdrop for hub pages: dark navy, slow aurora blobs and a few floating dice / pips / coins.
// Absolutely positioned (zero-specificity defaults, so a className can override), aria-hidden, pointer-events none.
// Animation is pure CSS and switches off under prefers-reduced-motion.
import { memo } from 'react';
import { HUB, RUPEE } from './kit.jsx';

const CSS = `
:where(.hbd){position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;contain:layout paint;background:linear-gradient(180deg,#0a0f20 0%,#0b1226 55%,#0e1430 100%)}
.hbd i{position:absolute;display:block;border-radius:50%;will-change:transform}
.hbd .b1{width:112vmin;height:112vmin;left:-30vmin;top:-38vmin;background:radial-gradient(closest-side,rgba(124,92,255,.42),rgba(124,92,255,.16) 50%,rgba(124,92,255,0));animation:hbd-a 46s ease-in-out infinite}
.hbd .b2{width:96vmin;height:96vmin;right:-34vmin;top:6%;background:radial-gradient(closest-side,rgba(46,196,182,.28),rgba(46,196,182,.1) 50%,rgba(46,196,182,0));animation:hbd-b 52s ease-in-out infinite}
.hbd .b3{width:104vmin;height:104vmin;left:12%;bottom:-52vmin;background:radial-gradient(closest-side,rgba(255,93,115,.24),rgba(255,93,115,.09) 50%,rgba(255,93,115,0));animation:hbd-c 58s ease-in-out infinite}
.hbd .b4{width:70vmin;height:70vmin;right:8%;bottom:-24vmin;background:radial-gradient(closest-side,rgba(255,200,87,.15),rgba(255,200,87,.05) 50%,rgba(255,200,87,0));animation:hbd-a 64s ease-in-out -20s infinite}
.hbd svg{position:absolute;inset:0;width:100%;height:100%}
.hbd .f{animation:hbd-f 15s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.hbd .f2{animation-duration:19s;animation-delay:-7s}
.hbd .f3{animation-duration:23s;animation-delay:-3s}
.hbd .f4{animation-duration:17s;animation-delay:-11s}
@keyframes hbd-a{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(7vmin,5vmin,0)}}
@keyframes hbd-b{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(-8vmin,6vmin,0)}}
@keyframes hbd-c{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(6vmin,-7vmin,0)}}
@keyframes hbd-f{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-16px) rotate(7deg)}}
@media (prefers-reduced-motion:reduce){.hbd i,.hbd .f{animation:none!important}}
`;

const Die = ({ s = 52, n = 5 }) => {
  const q = s * 0.26, m = s / 2;
  const L = { 5: [[q, q], [s - q, q], [m, m], [q, s - q], [s - q, s - q]], 3: [[q, q], [m, m], [s - q, s - q]], 6: [[q, q], [s - q, q], [q, m], [s - q, m], [q, s - q], [s - q, s - q]], 2: [[q, q], [s - q, s - q]] }[n];
  return (
    <g>
      <rect width={s} height={s} rx={s * 0.24} fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.3)" strokeWidth="2" />
      {L.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={s * 0.075} fill="rgba(255,255,255,.34)" />)}
    </g>
  );
};

const Coin = ({ r = 20 }) => (
  <g>
    <circle r={r} fill="rgba(255,200,87,.1)" stroke="rgba(255,200,87,.5)" strokeWidth="2" />
    <circle r={r * 0.72} fill="none" stroke="rgba(255,200,87,.3)" strokeWidth="1.4" />
    <path d={RUPEE} transform={`scale(${r / 22})`} fill="none" stroke="rgba(255,200,87,.6)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

const Card = ({ w = 36, c = HUB.rose }) => (
  <g>
    <rect x={-w / 2} y={-w * 0.7} width={w} height={w * 1.4} rx="6" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.26)" strokeWidth="2" />
    <path d={`M0 ${w * 0.26}C${-w * 0.42} -${w * 0.02} ${-w * 0.3} ${-w * 0.3} 0 ${-w * 0.12}C${w * 0.3} ${-w * 0.3} ${w * 0.42} ${-w * 0.02} 0 ${w * 0.26}Z`} fill={c} opacity=".5" />
  </g>
);

const Pip = ({ r = 8, c }) => <circle r={r} fill={c} opacity=".42" />;

function HubBackdropBase({ className }) {
  return (
    <div className={className ? `hbd ${className}` : 'hbd'} aria-hidden="true">
      <style>{CSS}</style>
      <i className="b1" />
      <i className="b2" />
      <i className="b3" />
      <i className="b4" />
      <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" focusable="false">
        <g transform="translate(110 150) rotate(-14)"><g className="f"><Die s={56} n={5} /></g></g>
        <g transform="translate(1040 120) rotate(12)"><g className="f f3"><Die s={44} n={3} /></g></g>
        <g transform="translate(980 600) rotate(-9)"><g className="f f2"><Die s={64} n={6} /></g></g>
        <g transform="translate(240 640) rotate(16)"><g className="f f4"><Die s={40} n={2} /></g></g>
        <g transform="translate(700 70)"><g className="f f2"><Coin r={22} /></g></g>
        <g transform="translate(60 440)"><g className="f f3"><Coin r={16} /></g></g>
        <g transform="translate(1120 380)"><g className="f"><Coin r={18} /></g></g>
        <g transform="translate(520 720) rotate(-12)"><g className="f f4"><Card w={34} c={HUB.rose} /></g></g>
        <g transform="translate(860 300) rotate(14)"><g className="f f3"><Card w={30} c={HUB.sky} /></g></g>
        <g transform="translate(360 90)"><g className="f f2"><Pip r={9} c={HUB.p1} /></g></g>
        <g transform="translate(1160 700)"><g className="f f4"><Pip r={11} c={HUB.p2} /></g></g>
        <g transform="translate(150 760)"><g className="f"><Pip r={7} c={HUB.p3} /></g></g>
        <g transform="translate(600 440)"><g className="f f3"><Pip r={6} c={HUB.p4} /></g></g>
        <g transform="translate(900 60)"><g className="f f4"><Pip r={5} c={HUB.p3} /></g></g>
        <g transform="translate(30 270)"><g className="f f2"><Pip r={5} c={HUB.p2} /></g></g>
      </svg>
    </div>
  );
}
export const HubBackdrop = memo(HubBackdropBase);
