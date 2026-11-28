import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { MiniGameProps } from '../../game/minigames/types.ts';
import {
  DIAL_NOTCHES,
  TUMBLER_COUNT,
  attemptsLeft,
  createSafeState,
  lockTumbler,
  requiredDirection,
  rotateDial,
  type DialDirection,
  type DialTick,
  type SafeState,
} from '../../game/minigames/safeDial.ts';
import { playBoxChime, playClick, playDialTick, playHover, playLocked, playSafeOpen } from '../../game/audio/soundEngine.ts';
import { miniGameClose, useMiniGameEscape } from './miniGameClose.ts';

const MODE_LABEL = { cozy: 'Cozy', challenge: 'Challenge' } as const;
const NOTCH_DEG = 360 / DIAL_NOTCHES;
/** Holding ↺ / ↻: first repeat after this pause, then a notch every `HOLD_REPEAT_MS` */
const HOLD_DELAY_MS = 320;
const HOLD_REPEAT_MS = 90;

const DIR_TEXT: Record<DialDirection, { arrow: string; label: string }> = {
  cw: { arrow: '↻', label: 'Clockwise' },
  ccw: { arrow: '↺', label: 'Counter-clockwise' },
};

const TICK_RANK: Record<DialTick, number> = { tick: 0, near: 1, catch: 2 };

/** Pointer angle around the dial centre, in degrees clockwise from the top */
function pointerAngle(el: Element, x: number, y: number): number {
  const r = el.getBoundingClientRect();
  return (Math.atan2(x - (r.left + r.width / 2), -(y - (r.top + r.height / 2))) * 180) / Math.PI;
}

/**
 * Safe Dial scavenging mini-game: turn a 40-notch brass dial the indicated way, listen for
 * the tumbler's clunk (a subtle shiver & glint shows it too) and Set each of three numbers.
 * Cozy forgives wrong numbers (±2 notches catch); Challenge catches only ±1 and jams after
 * three wrong lock-ins. "Safe unlocked!" offers Continue; × / Escape cancel.
 */
export default function SafeDialGame({
  mode,
  title = 'Old Safe',
  allowRetryOnLoss = true,
  onComplete,
  onCancel,
}: MiniGameProps) {
  const uid = `safe${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [game, setGame] = useState<SafeState>(() => createSafeState(mode));
  /* Continuous face rotation (degrees, clockwise) so turning past 0 never spins the long way */
  const [angle, setAngle] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [catchCue, setCatchCue] = useState(0);
  const gameRef = useRef(game);
  const cardRef = useRef<HTMLElement>(null);
  const drag = useRef<{ pointerId: number; last: number; accum: number } | null>(null);
  const hold = useRef<{ timer: ReturnType<typeof setTimeout> | null; interval: ReturnType<typeof setInterval> | null }>({
    timer: null,
    interval: null,
  });

  const finished = game.status !== 'playing';
  const direction = requiredDirection(game);
  const left = attemptsLeft(game);

  const commit = (next: SafeState) => {
    gameRef.current = next;
    setGame(next);
  };

  /** Turn `steps` notches (positive = clockwise), with a tick for the most telling notch passed */
  const turn = (steps: number) => {
    const r = rotateDial(gameRef.current, steps);
    if (r.ticks.length === 0) return;
    const loudest = r.ticks.reduce((a, b) => (TICK_RANK[b] > TICK_RANK[a] ? b : a));
    playDialTick(loudest);
    if (loudest === 'catch') setCatchCue((n) => n + 1);
    setAngle((a) => a + steps * NOTCH_DEG);
    setHint(null);
    commit(r.state);
  };

  const stopHold = () => {
    if (hold.current.timer) clearTimeout(hold.current.timer);
    if (hold.current.interval) clearInterval(hold.current.interval);
    hold.current = { timer: null, interval: null };
  };

  useEffect(() => stopHold, []);

  const lock = () => {
    const before = gameRef.current;
    const { state, result } = lockTumbler(before);
    const need = requiredDirection(before);
    switch (result.kind) {
      case 'invalid':
        return;
      case 'not-turned':
        setHint('Turn the dial first, then Set');
        return;
      case 'set':
        if (state.status === 'win') playSafeOpen();
        else playBoxChime();
        setHint(null);
        break;
      case 'wrong-direction':
        playLocked();
        setHint(need ? `This tumbler only catches turning ${DIR_TEXT[need].arrow} ${DIR_TEXT[need].label.toLowerCase()}` : null);
        break;
      case 'wrong-position':
        playLocked();
        if (mode === 'cozy') {
          setHint(
            result.close
              ? 'So close — ease it a notch or two and listen for the clunk'
              : `Not this number — keep turning ${need ? DIR_TEXT[need].arrow : ''} and listen for the clunk`,
          );
        } else {
          setHint('Wrong number');
        }
        break;
    }
    commit(state);
  };

  /* Arrow keys / A–D turn the dial; Space / Enter set (unless a button has focus — it clicks itself) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (t?.closest?.('[role="dialog"]') && !cardRef.current?.contains(t)) return;
      if (gameRef.current.status !== 'playing') return;
      const key = e.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') {
        e.preventDefault();
        turn(-1);
      } else if (key === 'arrowright' || key === 'd') {
        e.preventDefault();
        turn(1);
      } else if ((key === ' ' || key === 'enter') && t?.tagName !== 'BUTTON') {
        e.preventDefault();
        lock();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    cardRef.current?.querySelector<HTMLButtonElement>('.ows-safe-set')?.focus();
  }, []);

  const onDialDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (finished || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointerId: e.pointerId, last: pointerAngle(e.currentTarget, e.clientX, e.clientY), accum: 0 };
  };

  const onDialMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const a = pointerAngle(e.currentTarget, e.clientX, e.clientY);
    let delta = a - d.last;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    d.last = a;
    d.accum += delta;
    const steps = Math.trunc(d.accum / NOTCH_DEG);
    if (steps !== 0) {
      d.accum -= steps * NOTCH_DEG;
      turn(steps);
    }
  };

  const endDrag = () => {
    drag.current = null;
  };

  const startHold = (steps: number) => {
    if (finished) return;
    stopHold();
    turn(steps);
    hold.current.timer = setTimeout(() => {
      hold.current.interval = setInterval(() => turn(steps), HOLD_REPEAT_MS);
    }, HOLD_DELAY_MS);
  };

  const playAgain = () => {
    playClick();
    stopHold();
    commit(createSafeState(mode));
    setAngle(0);
    setHint(null);
  };

  const finish = () => {
    if (!finished) return;
    playClick();
    onComplete({ outcome: game.status === 'win' ? 'win' : 'loss', mode });
  };

  /* Once finished, × / Escape report the result like Continue */
  const close = miniGameClose(finished, finish, onCancel);
  useMiniGameEscape(close);

  let statusText: string;
  let statusMod: string;
  if (game.status === 'win') {
    statusText = 'Safe unlocked!';
    statusMod = 'win';
  } else if (game.status === 'loss') {
    statusText = allowRetryOnLoss ? 'The dial jammed' : 'The dial jammed — try again tomorrow';
    statusMod = 'loss';
  } else if (hint) {
    statusText = hint;
    statusMod = 'turn';
  } else {
    statusText = `Turn ${direction ? DIR_TEXT[direction].label.toLowerCase() : ''} and listen for the clunk, then Set`;
    statusMod = 'turn';
  }

  const shown = Math.min(game.set + (game.status === 'win' ? 0 : 1), TUMBLER_COUNT);

  return (
    <div className="ows-mg-overlay">
      <section
        ref={cardRef}
        className={`ows-mg-card ows-safe-card ows-safe-card--${mode}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
      >
        <header className="ows-mg-header">
          <h2 id={`${uid}-title`} className="ows-mg-title">
            {title}
          </h2>
          <span className="ows-safe-progress" aria-label={`${game.set} of ${TUMBLER_COUNT} tumblers set`}>
            {game.set} / {TUMBLER_COUNT}
          </span>
          <span className={`ows-mg-badge ows-mg-badge--${mode}`}>{MODE_LABEL[mode]}</span>
          <button type="button" className="ows-mg-close" aria-label="Close" onMouseEnter={playHover} onClick={close}>
            ×
          </button>
        </header>

        <div className="ows-safe-body">
          <div className={`ows-safe-plate ${game.status === 'win' ? 'ows-safe-plate--open' : ''}`}>
            {/* Three tumbler pins */}
            <div className="ows-safe-pins" aria-hidden="true">
              {Array.from({ length: TUMBLER_COUNT }, (_, i) => (
                <span key={i} className={`ows-safe-pin ${i < game.set ? 'ows-safe-pin--set' : i === game.set && !finished ? 'ows-safe-pin--active' : ''}`} />
              ))}
            </div>

            <svg
              className="ows-safe-dial"
              viewBox="-120 -120 240 240"
              role="slider"
              tabIndex={-1}
              aria-label="Combination dial"
              aria-valuemin={0}
              aria-valuemax={DIAL_NOTCHES - 1}
              aria-valuenow={game.position}
              onPointerDown={onDialDown}
              onPointerMove={onDialMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onLostPointerCapture={endDrag}
            >
              <defs>
                <radialGradient id={`${uid}-brass`} cx="0.38" cy="0.32" r="0.75">
                  <stop offset="0" stopColor="#f2d58e" />
                  <stop offset="0.55" stopColor="#c39a48" />
                  <stop offset="1" stopColor="#7a5520" />
                </radialGradient>
                <radialGradient id={`${uid}-knob`} cx="0.4" cy="0.35" r="0.7">
                  <stop offset="0" stopColor="#e6c77c" />
                  <stop offset="1" stopColor="#8a6326" />
                </radialGradient>
              </defs>
              {/* Fixed brass bezel and the index mark at the top */}
              <circle r={112} fill="#2b2a2b" stroke="#141313" strokeWidth={3} />
              <circle r={106} fill={`url(#${uid}-brass)`} stroke="#3a281b" strokeWidth={3} />
              <path d="M-9 -118 L9 -118 L0 -101 Z" className="ows-safe-index" />

              {/* The turning face (with its catch shiver) */}
              <g key={catchCue} className={catchCue > 0 ? 'ows-safe-shiver' : undefined}>
                <g className="ows-safe-face" style={{ transform: `rotate(${angle}deg)` }}>
                  <circle r={92} fill="#e9dcc0" stroke="#5a3d22" strokeWidth={2.5} />
                  <circle r={90} fill="none" stroke="rgba(120, 84, 48, 0.25)" strokeWidth={6} />
                  {Array.from({ length: DIAL_NOTCHES }, (_, n) => {
                    const major = n % 5 === 0;
                    return (
                      <line
                        key={n}
                        x1={0}
                        y1={-90}
                        x2={0}
                        y2={major ? -76 : -82}
                        stroke="#3a281b"
                        strokeWidth={major ? 2.6 : 1.4}
                        transform={`rotate(${n * NOTCH_DEG})`}
                      />
                    );
                  })}
                  {Array.from({ length: DIAL_NOTCHES / 5 }, (_, i) => i * 5).map((n) => (
                    <text key={n} className="ows-safe-number" transform={`rotate(${n * NOTCH_DEG}) translate(0 -63)`}>
                      {n}
                    </text>
                  ))}
                  {/* Knurled knob */}
                  <circle r={40} fill={`url(#${uid}-knob)`} stroke="#3a281b" strokeWidth={3} />
                  {Array.from({ length: 24 }, (_, i) => (
                    <line key={i} x1={0} y1={-40} x2={0} y2={-33} stroke="rgba(58, 40, 27, 0.55)" strokeWidth={2} transform={`rotate(${i * 15})`} />
                  ))}
                  <circle r={14} fill="#a77d38" stroke="#5a3d22" strokeWidth={2} />
                </g>
              </g>
              {catchCue > 0 && <circle key={`g${catchCue}`} r={100} className="ows-safe-glint" />}
            </svg>

            <span className="ows-safe-readout" aria-live="off">
              {game.position}
            </span>
          </div>

          <div className="ows-safe-side">
            <p className="ows-safe-step">
              {game.status === 'win' ? 'All tumblers set' : `Tumbler ${shown} of ${TUMBLER_COUNT}`}
            </p>
            {direction && !finished && (
              <p className="ows-safe-direction">
                <span className="ows-safe-direction__arrow" aria-hidden="true">
                  {DIR_TEXT[direction].arrow}
                </span>
                {DIR_TEXT[direction].label}
              </p>
            )}

            <p className={`ows-mg-status ows-mg-status--${statusMod}`} role="status" aria-live="polite">
              {statusText}
            </p>
            {left !== null && !finished && (
              <p className="ows-safe-attempts">
                {left} {left === 1 ? 'try' : 'tries'} left
              </p>
            )}

            {!finished ? (
              <div className="ows-safe-controls">
                <button
                  type="button"
                  className="ows-mg-btn ows-safe-turn"
                  aria-label="Turn counter-clockwise"
                  onPointerDown={(e) => e.button === 0 && startHold(-1)}
                  onPointerUp={stopHold}
                  onPointerLeave={stopHold}
                  onPointerCancel={stopHold}
                  onClick={(e) => e.detail === 0 && turn(-1)}
                >
                  ↺
                </button>
                <button type="button" className="ows-mg-btn ows-mg-btn--primary ows-safe-set" onMouseEnter={playHover} onClick={lock}>
                  Set
                </button>
                <button
                  type="button"
                  className="ows-mg-btn ows-safe-turn"
                  aria-label="Turn clockwise"
                  onPointerDown={(e) => e.button === 0 && startHold(1)}
                  onPointerUp={stopHold}
                  onPointerLeave={stopHold}
                  onPointerCancel={stopHold}
                  onClick={(e) => e.detail === 0 && turn(1)}
                >
                  ↻
                </button>
              </div>
            ) : (
              <footer className="ows-mg-footer">
                {game.status === 'loss' && allowRetryOnLoss && (
                  <button type="button" className="ows-mg-btn" onMouseEnter={playHover} onClick={playAgain}>
                    Play Again
                  </button>
                )}
                <button type="button" className="ows-mg-btn ows-mg-btn--primary" onMouseEnter={playHover} onClick={finish}>
                  Continue
                </button>
              </footer>
            )}
            <p className="ows-safe-keys" aria-hidden="true">
              ← → or A / D to turn · Space to set
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
