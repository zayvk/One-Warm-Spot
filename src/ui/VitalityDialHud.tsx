import { useGameStore } from '../game/store/useGameStore.ts';
import { MAX_VITALITY, PHASE_DURATION_SEC } from '../game/engine/dayCycle.ts';
import type { DayPhase } from '../game/types/game.ts';

const PHASE_LABEL: Record<DayPhase, string> = {
  day: 'Day · Sunlit',
  dusk: 'Dusk · Sunset',
  night: 'Night · Quiet Moonlight',
};

const RING_R = 32;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function PhaseSkyIcon({ phase, active }: { phase: DayPhase; active: boolean }) {
  const style: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: active ? 1 : 0,
    transform: active ? 'scale(1)' : 'scale(0.82)',
    transition: 'opacity 500ms ease, transform 500ms ease',
    pointerEvents: 'none',
  };

  if (phase === 'day') {
    return (
      <span style={style} aria-hidden="true">
        <svg viewBox="0 0 36 36" width="32" height="32">
          <circle cx="18" cy="18" r="7.5" fill="#f3b24a" stroke="#b97524" strokeWidth="1.4" />
          <g stroke="#e09a33" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="4.5" x2="18" y2="7.5" />
            <line x1="18" y1="28.5" x2="18" y2="31.5" />
            <line x1="4.5" y1="18" x2="7.5" y2="18" />
            <line x1="28.5" y1="18" x2="31.5" y2="18" />
            <line x1="8.4" y1="8.4" x2="10.6" y2="10.6" />
            <line x1="25.4" y1="25.4" x2="27.6" y2="27.6" />
            <line x1="27.6" y1="8.4" x2="25.4" y2="10.6" />
            <line x1="10.6" y1="25.4" x2="8.4" y2="27.6" />
          </g>
        </svg>
      </span>
    );
  }

  if (phase === 'dusk') {
    return (
      <span style={style} aria-hidden="true">
        <svg viewBox="0 0 36 36" width="32" height="32">
          <path d="M9 22 A9 9 0 0 1 27 22 Z" fill="#e57c4b" stroke="#a64b25" strokeWidth="1.4" />
          <line x1="5" y1="22.5" x2="31" y2="22.5" stroke="#8a5a3c" strokeWidth="2" strokeLinecap="round" />
          <line x1="9" y1="26.5" x2="27" y2="26.5" stroke="#c88d65" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <line x1="18" y1="7" x2="18" y2="10" stroke="#e58952" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="10" y1="11.5" x2="12" y2="13.5" stroke="#e58952" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="26" y1="11.5" x2="24" y2="13.5" stroke="#e58952" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  return (
    <span style={style} aria-hidden="true">
      <svg viewBox="0 0 36 36" width="32" height="32">
        <path
          d="M20.5 8.5 A9.5 9.5 0 1 0 27.5 23.5 A7.5 7.5 0 1 1 20.5 8.5 Z"
          fill="#f2e5b8"
          stroke="#c8b98a"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <circle cx="25.5" cy="11.5" r="1.2" fill="#fff8dc" />
        <circle cx="28" cy="16.5" r="0.9" fill="#fff8dc" opacity="0.85" />
        <circle cx="11.5" cy="11" r="0.9" fill="#fff8dc" opacity="0.75" />
      </svg>
    </span>
  );
}

/**
 * VitalityDialHud — Handcrafted bottom-left circular phase dial with Day crest
 * and attached horizontal glass test-tube capsule for Stamina & Strength.
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
      ? `Day ${day} · ${PHASE_LABEL[dayPhase]} — sleep by shelter for morning`
      : `Day ${day} · ${PHASE_LABEL[dayPhase]} (${remMin}:${remSec} remaining)`;

  const ringColor =
    dayPhase === 'day' ? '#dfa244' : dayPhase === 'dusk' ? '#d8764a' : '#8da2cf';

  return (
    <aside className="ows-vitality-hud" aria-label="Traveler clock and vitality">
      {/* Left Circular Time Dial (~72px) */}
      <div className={`ows-time-dial ows-time-dial--${dayPhase}`} title={dialTitle}>
        <span className="ows-day-crest">Day {day}</span>

        <svg
          className="ows-time-dial__ring"
          viewBox="0 0 72 72"
          width="72"
          height="72"
          aria-hidden="true"
        >
          <circle
            cx="36"
            cy="36"
            r={RING_R}
            fill="none"
            stroke="rgba(181, 141, 82, 0.22)"
            strokeWidth="3.5"
          />
          <circle
            cx="36"
            cy="36"
            r={RING_R}
            fill="none"
            stroke={ringColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={strokeOffset}
            transform="rotate(-90 36 36)"
            className="ows-time-dial__progress"
          />
        </svg>

        <PhaseSkyIcon phase="day" active={dayPhase === 'day'} />
        <PhaseSkyIcon phase="dusk" active={dayPhase === 'dusk'} />
        <PhaseSkyIcon phase="night" active={dayPhase === 'night'} />
      </div>

      {/* Attached Horizontal Test-Tube Vitality Capsule */}
      <div className="ows-vitality-tube">
        <div
          className="ows-vitality-row"
          title={`Stamina ${stamina}/${MAX_VITALITY} — how rested you are`}
        >
          <div className="ows-vitality-meta">
            <span>⚡ Stamina</span>
            <span className="ows-vitality-val">
              {stamina}/{MAX_VITALITY}
            </span>
          </div>
          <div
            className="ows-vitality-track"
            role="meter"
            aria-label="Stamina"
            aria-valuemin={0}
            aria-valuemax={MAX_VITALITY}
            aria-valuenow={stamina}
          >
            <span
              className="ows-vitality-fill ows-vitality-fill--stamina"
              style={{ width: `${stamina}%` }}
            />
          </div>
        </div>

        <div
          className="ows-vitality-row"
          title={`Strength ${strength}/${MAX_VITALITY} — nourishment and resilience`}
        >
          <div className="ows-vitality-meta">
            <span>🧡 Strength</span>
            <span className="ows-vitality-val">
              {strength}/{MAX_VITALITY}
            </span>
          </div>
          <div
            className="ows-vitality-track"
            role="meter"
            aria-label="Strength"
            aria-valuemin={0}
            aria-valuemax={MAX_VITALITY}
            aria-valuenow={strength}
          >
            <span
              className="ows-vitality-fill ows-vitality-fill--strength"
              style={{ width: `${strength}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
