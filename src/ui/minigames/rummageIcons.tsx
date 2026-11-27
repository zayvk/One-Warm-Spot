import type { ReactNode } from 'react';
import { RUMMAGE_ART_SCALE, getRummageItem, type RummageItemId } from '../../game/minigames/findTheObject.ts';

/* One Warm Spot's muted salvage palette, outlined in espresso ink */
const INK = '#3a281b';
const WOOD = '#b07a48';
const WOOD_D = '#8a5c36';
const BRASS = '#cfa64e';
const BRASS_D = '#9c7a30';
const COPPER = '#c27a4a';
const TERRA = '#c8775a';
const TERRA_D = '#a95a36';
const SAGE = '#8fb07f';
const SAGE_D = '#5f7f54';
const CREAM = '#f6ead2';
const PARCH = '#ead7b0';
const TIN = '#b3bab4';
const TIN_D = '#87908a';
const IRON = '#6f6862';
const RUST = '#a2613a';
const GLASS = '#cfe4df';
const BOTTLE = '#7fa58a';
const STRAW = '#dbb86c';
const LEAF = '#cc8b42';

const noInk = { stroke: 'none' } as const;

/* Each drawing lives in its own base box (the numbers in `art(w, h)` in findTheObject.ts) */
const ART: Record<RummageItemId, () => ReactNode> = {
  thread: () => (
    <>
      <rect x={24} y={28} width={72} height={94} fill={TERRA} />
      {[44, 61, 78, 95, 112].map((y) => (
        <line key={y} x1={26} y1={y} x2={94} y2={y - 6} stroke={TERRA_D} strokeWidth={4} />
      ))}
      <rect x={10} y={8} width={100} height={22} rx={6} fill={WOOD} />
      <rect x={10} y={120} width={100} height={22} rx={6} fill={WOOD} />
      <path d="M96 100 C110 108 104 126 116 136" fill="none" stroke={TERRA_D} strokeWidth={4} />
    </>
  ),
  seeds: () => (
    <>
      <rect x={8} y={8} width={114} height={154} rx={6} fill={PARCH} />
      <rect x={8} y={8} width={114} height={30} rx={6} fill={SAGE} />
      <path d="M65 140 L65 72" fill="none" stroke={SAGE_D} strokeWidth={5} />
      <ellipse cx={48} cy={92} rx={18} ry={9} transform="rotate(-30 48 92)" fill={SAGE} />
      <ellipse cx={82} cy={78} rx={18} ry={9} transform="rotate(30 82 78)" fill={SAGE} />
      <ellipse cx={65} cy={64} rx={8} ry={12} fill={TERRA} />
      {[36, 56, 76, 96].map((x) => (
        <circle key={x} cx={x} cy={150} r={4} fill={WOOD_D} {...noInk} />
      ))}
    </>
  ),
  key: () => (
    <>
      <rect x={150} y={48} width={14} height={24} fill={BRASS} />
      <rect x={172} y={48} width={14} height={32} fill={BRASS} />
      <rect x={66} y={36} width={124} height={18} rx={5} fill={BRASS} />
      <circle cx={40} cy={45} r={32} fill={BRASS} />
      <circle cx={40} cy={45} r={13} fill="#6b4a2c" />
      <path d="M22 30 Q30 20 42 18" fill="none" stroke="#f3dc9a" strokeWidth={5} />
    </>
  ),
  coil: () => (
    <>
      {[30, 52, 74, 96, 118, 140].map((cx) => (
        <ellipse key={`i${cx}`} cx={cx} cy={65} rx={15} ry={50} fill="none" stroke={INK} strokeWidth={16} />
      ))}
      {[30, 52, 74, 96, 118, 140].map((cx) => (
        <ellipse key={`c${cx}`} cx={cx} cy={65} rx={15} ry={50} fill="none" stroke={COPPER} strokeWidth={9} />
      ))}
      <path d="M140 15 L166 8" fill="none" stroke={COPPER} strokeWidth={8} />
    </>
  ),
  matchbox: () => (
    <>
      <rect x={70} y={22} width={92} height={66} rx={3} fill={CREAM} />
      {[36, 52, 68].map((y) => (
        <g key={y}>
          <line x1={84} y1={y} x2={146} y2={y} stroke={WOOD} strokeWidth={7} />
          <circle cx={150} cy={y} r={7} fill={TERRA_D} />
        </g>
      ))}
      <rect x={8} y={14} width={110} height={82} rx={5} fill={TERRA} />
      <rect x={26} y={32} width={74} height={46} rx={3} fill={CREAM} />
      <path d="M63 70 C50 62 54 48 63 38 C70 50 76 60 63 70 Z" fill={BRASS} />
    </>
  ),
  mug: () => (
    <>
      <path d="M108 46 C148 46 148 104 108 104" fill="none" stroke={INK} strokeWidth={17} />
      <path d="M108 46 C148 46 148 104 108 104" fill="none" stroke={TIN} strokeWidth={8} />
      <rect x={18} y={24} width={94} height={108} rx={9} fill={TIN} />
      <rect x={20} y={62} width={90} height={14} fill={SAGE} {...noInk} />
      <ellipse cx={65} cy={25} rx={47} ry={11} fill={TIN_D} />
      <circle cx={40} cy={108} r={4} fill={TIN_D} {...noInk} />
    </>
  ),
  spoon: () => (
    <>
      <rect x={88} y={32} width={134} height={17} rx={8} fill={WOOD} />
      <ellipse cx={52} cy={40} rx={44} ry={30} fill={WOOD} />
      <ellipse cx={50} cy={40} rx={30} ry={18} fill={WOOD_D} opacity={0.55} {...noInk} />
      <line x1={110} y1={40} x2={200} y2={40} stroke={WOOD_D} strokeWidth={2} />
    </>
  ),
  jar: () => (
    <>
      <rect x={12} y={30} width={106} height={132} rx={18} fill={GLASS} fillOpacity={0.9} />
      <rect x={32} y={78} width={66} height={42} rx={3} fill={PARCH} />
      <line x1={42} y1={92} x2={88} y2={92} stroke={WOOD_D} strokeWidth={3} />
      <line x1={42} y1={105} x2={78} y2={105} stroke={WOOD_D} strokeWidth={3} />
      <path d="M26 52 L26 140" fill="none" stroke="#ffffff" strokeWidth={6} opacity={0.75} />
      <rect x={20} y={8} width={90} height={26} rx={5} fill={BRASS} />
      {[38, 56, 74, 92].map((x) => (
        <line key={x} x1={x} y1={12} x2={x} y2={30} stroke={BRASS_D} strokeWidth={3} />
      ))}
    </>
  ),
  bolt: () => (
    <>
      <rect x={48} y={26} width={114} height={28} rx={4} fill={RUST} />
      {[62, 78, 94, 110, 126, 142].map((x) => (
        <line key={x} x1={x} y1={27} x2={x + 8} y2={53} stroke={INK} strokeWidth={3} />
      ))}
      <polygon points="10,12 52,12 62,40 52,68 10,68 2,40" fill="#7a4a2c" />
      <line x1={10} y1={40} x2={58} y2={40} stroke="#5c3620" strokeWidth={3} />
      <circle cx={120} cy={46} r={5} fill="#c98a5a" {...noInk} />
    </>
  ),
  pinecone: () => (
    <>
      <rect x={54} y={4} width={12} height={20} rx={4} fill={WOOD_D} />
      <ellipse cx={60} cy={88} rx={48} ry={66} fill={WOOD_D} />
      {[38, 56, 74, 92, 110, 128].map((y, row) => {
        const half = row === 0 || row === 5 ? 1 : 2;
        const xs = Array.from({ length: half * 2 }, (_, i) => 60 + (i - half + 0.5) * 22);
        return xs.map((x) => <path key={`${y}-${x}`} d={`M${x - 12} ${y} Q${x} ${y + 16} ${x + 12} ${y}`} fill={WOOD} strokeWidth={4} />);
      })}
    </>
  ),
  rag: () => (
    <>
      <polygon points="14,36 162,20 174,98 24,110" fill={SAGE_D} />
      <polygon points="14,36 152,26 162,72 30,82" fill={SAGE} />
      <path d="M30 82 Q90 70 162 72" fill="none" strokeWidth={4} />
      {[34, 46, 58].map((y) => (
        <line key={y} x1={170} y1={y + 30} x2={178} y2={y + 34} strokeWidth={3} />
      ))}
      <line x1={50} y1={50} x2={120} y2={44} stroke={SAGE_D} strokeWidth={3} />
    </>
  ),
  button: () => (
    <>
      <circle cx={55} cy={55} r={48} fill={TERRA} />
      <circle cx={55} cy={55} r={35} fill="none" stroke={TERRA_D} strokeWidth={5} />
      {[
        [44, 44],
        [66, 44],
        [44, 66],
        [66, 66],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={6} fill={INK} {...noInk} />
      ))}
    </>
  ),
  twine: () => (
    <>
      <path d="M108 100 C126 114 118 130 136 134" fill="none" stroke={INK} strokeWidth={12} />
      <path d="M108 100 C126 114 118 130 136 134" fill="none" stroke={STRAW} strokeWidth={5} />
      <circle cx={66} cy={70} r={56} fill={STRAW} />
      {['M20 50 Q66 82 112 40', 'M14 82 Q70 112 120 78', 'M40 20 Q62 70 50 124', 'M88 16 Q102 70 92 124', 'M24 100 Q60 60 104 24'].map((d) => (
        <path key={d} d={d} fill="none" stroke="#a8843e" strokeWidth={4} />
      ))}
    </>
  ),
  wrench: () => (
    <>
      <rect x={58} y={30} width={118} height={20} rx={9} fill={TIN} />
      <path d="M12.1 29 L36 29 L36 51 L12.1 51 A30 30 0 1 0 12.1 29 Z" fill={TIN} />
      <circle cx={190} cy={40} r={22} fill={TIN} />
      <polygon points="190,29 199,34 199,46 190,51 181,46 181,34" fill={TIN_D} />
      <line x1={78} y1={40} x2={158} y2={40} stroke={TIN_D} strokeWidth={3} />
    </>
  ),
  leaf: () => (
    <>
      <path d="M14 62 L3 74" fill="none" strokeWidth={5} />
      <path d="M12 60 C42 12 120 2 162 40 C132 90 52 110 12 60 Z" fill={LEAF} />
      <path d="M16 60 C60 52 110 44 158 40" fill="none" stroke="#8a5a24" strokeWidth={4} />
      {[
        'M60 52 L74 26',
        'M96 46 L112 22',
        'M62 54 L84 82',
        'M100 48 L122 72',
      ].map((d) => (
        <path key={d} d={d} fill="none" stroke="#8a5a24" strokeWidth={3} />
      ))}
    </>
  ),
  bottle: () => (
    <>
      <path
        d="M32 36 L32 66 C32 88 10 94 10 120 L10 184 Q10 194 20 194 L70 194 Q80 194 80 184 L80 120 C80 94 58 88 58 66 L58 36 Z"
        fill={BOTTLE}
        fillOpacity={0.92}
      />
      <rect x={20} y={130} width={50} height={36} rx={3} fill={PARCH} />
      <path d="M22 118 L22 180" fill="none" stroke="#e6f2ec" strokeWidth={5} opacity={0.8} />
      <rect x={30} y={6} width={30} height={34} rx={5} fill="#c8a070" />
      <line x1={34} y1={18} x2={56} y2={18} stroke={WOOD_D} strokeWidth={2} />
    </>
  ),
  patch: () => (
    <>
      <rect x={10} y={10} width={120} height={120} rx={6} fill="#e4b9a2" />
      {[
        [10, 10],
        [70, 10],
        [40, 40],
        [100, 40],
        [10, 70],
        [70, 70],
        [40, 100],
        [100, 100],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={30} height={30} fill={TERRA} opacity={0.45} {...noInk} />
      ))}
      <rect x={21} y={21} width={98} height={98} fill="none" strokeWidth={3} strokeDasharray="8 7" />
    </>
  ),
  nail: () => (
    <>
      <polygon points="30,19 170,19 197,25 170,31 30,31" fill={IRON} />
      <line x1={40} y1={22} x2={160} y2={22} stroke="#938b84" strokeWidth={2} />
      <rect x={14} y={4} width={18} height={42} rx={4} fill="#57504b" />
    </>
  ),
};

/** The base drawing box of an item (its catalog size before `RUMMAGE_ART_SCALE`) */
function baseBox(id: RummageItemId): { w: number; h: number } {
  const def = getRummageItem(id);
  return { w: (def.width * 1000) / RUMMAGE_ART_SCALE, h: (def.height * 1000) / RUMMAGE_ART_SCALE };
}

/** An item drawn in its base box, inked in espresso */
export function RummageArt({ id }: { id: RummageItemId }) {
  return (
    <g stroke={INK} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round">
      {ART[id]()}
    </g>
  );
}

/** A small standalone icon of an item (for the checklist) */
export function RummageIcon({ id, className }: { id: RummageItemId; className?: string }) {
  const { w, h } = baseBox(id);
  const pad = 8;
  return (
    <svg className={className} viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`} aria-hidden="true">
      <RummageArt id={id} />
    </svg>
  );
}
