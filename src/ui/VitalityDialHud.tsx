import { useGameStore } from '../game/store/useGameStore.ts';
import { MAX_VITALITY, PHASE_DURATION_SEC } from '../game/engine/dayCycle.ts';
import type { DayPhase } from '../game/types/game.ts';

const PHASE_LABEL: Record<DayPhase, string> = {
  day: 'Day · Sunlit',
  dusk: 'Dusk · Sunset',
  night: 'Night · Quiet Moonlight',
};

/* Progress ring runs inside the 78px medallion's bronze bezel */
const MEDALLION = 78;
const RING_R = 35.5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

const RING_COLOR: Record<DayPhase, string> = {
  day: '#f6c768',
  dusk: '#f08a55',
  night: '#a9bcf0',
};

/** Large radiant full sun filling the sunlit sky window */
function DaySky() {
  const rays = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6);
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="owsm-sun-glow">
          <stop offset="0%" stopColor="#fff6cf" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#ffd56a" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ffd56a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="owsm-sun-disc" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#fffbe6" />
          <stop offset="45%" stopColor="#ffd863" />
          <stop offset="100%" stopColor="#f0a531" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#owsm-sun-glow)" />
      <g stroke="#fff0b5" strokeWidth="2.6" strokeLinecap="round" opacity="0.92">
        {rays.map((a) => (
          <line
            key={a}
            x1={32 + Math.cos(a) * 17.5}
            y1={32 + Math.sin(a) * 17.5}
            x2={32 + Math.cos(a) * 25}
            y2={32 + Math.sin(a) * 25}
          />
        ))}
      </g>
      <circle cx="32" cy="32" r="13.5" fill="url(#owsm-sun-disc)" stroke="#d9902f" strokeWidth="1.2" />
    </svg>
  );
}

/** Big dusky sun dipping low over a warm horizon */
function DuskSky() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="owsm-dusk-glow" cy="68%">
          <stop offset="0%" stopColor="#ffd08a" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#f2875a" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#f2875a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="owsm-dusk-disc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe3a0" />
          <stop offset="55%" stopColor="#f6a15a" />
          <stop offset="100%" stopColor="#e0663f" />
        </linearGradient>
        <clipPath id="owsm-dusk-horizon">
          <rect x="0" y="0" width="64" height="44" />
        </clipPath>
      </defs>
      <circle cx="32" cy="44" r="29" fill="url(#owsm-dusk-glow)" />
      <circle cx="32" cy="44" r="19" fill="url(#owsm-dusk-disc)" clipPath="url(#owsm-dusk-horizon)" />
      <rect x="0" y="44" width="64" height="20" fill="#5e3328" />
      <rect x="0" y="44" width="64" height="1.6" fill="#ffc98a" opacity="0.8" />
      <g stroke="#f7b27a" strokeLinecap="round" opacity="0.6">
        <line x1="18" y1="49" x2="46" y2="49" strokeWidth="1.4" />
        <line x1="24" y1="53" x2="40" y2="53" strokeWidth="1.2" />
      </g>
    </svg>
  );
}

/** Calm starry indigo sky with a large luminous half moon */
function NightSky() {
  const stars: [number, number, number][] = [
    [10, 14, 0.9], [18, 8, 0.6], [50, 12, 0.8], [56, 22, 0.55], [8, 34, 0.6],
    [12, 50, 0.75], [54, 46, 0.65], [46, 56, 0.5], [24, 56, 0.55], [58, 34, 0.5],
  ];
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="owsm-moon-glow">
          <stop offset="0%" stopColor="#f6efd0" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#f6efd0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="owsm-moon-lit" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fffaea" />
          <stop offset="100%" stopColor="#e8d9a4" />
        </linearGradient>
      </defs>
      {stars.map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#f4f1ff" opacity="0.85" />
      ))}
      <circle cx="32" cy="32" r="28" fill="url(#owsm-moon-glow)" />
      {/* Earthshine on the unlit half, then the bright lit half */}
      <circle cx="32" cy="32" r="22" fill="#39427a" opacity="0.7" />
      <path d="M32 10 A22 22 0 0 1 32 54 Z" fill="url(#owsm-moon-lit)" />
      <g fill="#d6c58e" opacity="0.55">
        <circle cx="41" cy="24" r="2.6" />
        <circle cx="45" cy="36" r="1.8" />
        <circle cx="38" cy="44" r="2.2" />
      </g>
    </svg>
  );
}

const SKIES: Record<DayPhase, () => React.JSX.Element> = {
  day: DaySky,
  dusk: DuskSky,
  night: NightSky,
};

/**
 * VitalityDialHud — bottom-left bronze medallion (sky window for the current
 * phase, phase-progress ring, Day plaque) with smoked-glass Stamina & Strength bars.
 */
export default function VitalityDialHud() {
  const day = useGameStore((s) => s.day);
  const dayPhase = useGameStore((s) => s.dayPhase);
  const phaseElapsedSec = useGameStore((s) => s.phaseElapsedSec);
  const stamina = useGameStore((s) => s.stamina);
  const strength = useGameStore((s) => s.strength);

  const progress = Math.max(0, Math.min(1, phaseElapsedSec / PHASE_DURATION_SEC));
  const strokeOffset = RING_CIRCUMFERENCE * (1 - progress);
  const remainingSec = Math.max(0, Math.ceil(PHASE_DURATION_SEC - phaseElapsedSec));
  const remMin = Math.floor(remainingSec / 60);
  const remSec = String(remainingSec % 60).padStart(2, '0');

  const dialTitle =
    dayPhase === 'night'
      ? `Day ${day} · ${PHASE_LABEL[dayPhase]} — sleep by your shelter for morning`
      : `Day ${day} · ${PHASE_LABEL[dayPhase]} (${remMin}:${remSec} remaining)`;

  return (
    <aside className="ows-vitality-hud" aria-label="Traveler clock and vitality">
      <div className="ows-medallion-wrap">
        {/* Day plaque perched above the medallion — never under the ring */}
        <span className="ows-day-crest">Day {day}</span>

        <div className={`ows-medallion ows-medallion--${dayPhase}`} title={dialTitle} role="img" aria-label={dialTitle}>
          <div className="ows-medallion__sky">
            {(Object.keys(SKIES) as DayPhase[]).map((phase) => {
              const Sky = SKIES[phase];
              return (
                <div
                  key={phase}
                  className={`ows-medallion__layer ows-medallion__layer--${phase} ${
                    phase === dayPhase ? 'is-active' : ''
                  }`}
                >
                  <Sky />
                </div>
              );
            })}
          </div>

          <svg
            className="ows-medallion__ring"
            viewBox={`0 0 ${MEDALLION} ${MEDALLION}`}
            aria-hidden="true"
          >
            <circle
              cx={MEDALLION / 2}
              cy={MEDALLION / 2}
              r={RING_R}
              fill="none"
              stroke="rgba(28, 18, 10, 0.45)"
              strokeWidth="3"
            />
            <circle
              cx={MEDALLION / 2}
              cy={MEDALLION / 2}
              r={RING_R}
              fill="none"
              stroke={RING_COLOR[dayPhase]}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={strokeOffset}
              transform={`rotate(-90 ${MEDALLION / 2} ${MEDALLION / 2})`}
              className="ows-medallion__progress"
            />
          </svg>
        </div>
      </div>

      {/* Smoked-glass vitality bars extending from the medallion */}
      <div className="ows-vitality-tube">
        <VitalityBar
          kind="stamina"
          label="Stamina"
          value={stamina}
          hint="how rested you are"
        />
        <VitalityBar
          kind="strength"
          label="Strength"
          value={strength}
          hint="nourishment and resilience"
        />
      </div>
    </aside>
  );
}

function VitalityBar({
  kind,
  label,
  value,
  hint,
}: {
  kind: 'stamina' | 'strength';
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="ows-vitality-row" title={`${label} ${value}/${MAX_VITALITY} — ${hint}`}>
      <div className="ows-vitality-meta">
        <span className="ows-vitality-label">{label}</span>
        <span className="ows-vitality-val">
          {value}/{MAX_VITALITY}
        </span>
      </div>
      <div
        className="ows-vitality-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={MAX_VITALITY}
        aria-valuenow={value}
      >
        <span
          className={`ows-vitality-fill ows-vitality-fill--${kind}`}
          style={{ width: `${(value / MAX_VITALITY) * 100}%` }}
        />
      </div>
    </div>
  );
}
