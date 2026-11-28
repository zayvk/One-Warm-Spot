import { useEffect, useId, useRef, useState } from 'react';
import type { MiniGameProps } from '../../game/minigames/types.ts';
import {
  NAIL_COUNT,
  createNailState,
  markerAt,
  missesLeft,
  strikeNail,
  sweepMs,
  type Marker,
  type NailState,
} from '../../game/minigames/hitTheNail.ts';
import { useGameStore } from '../../game/store/useGameStore.ts';
import { playClick, playHover, playLocked, playNailClang, playNailFinish, playNailTink } from '../../game/audio/soundEngine.ts';
import { miniGameClose, useMiniGameEscape } from './miniGameClose.ts';

const MODE_LABEL = { cozy: 'Cozy', challenge: 'Challenge' } as const;

/* Board drawing space (400 × 190) */
const NAIL_X = [100, 200, 300] as const;
const SURFACE_Y = 118;
/** How far an undriven nail stands proud of the plank */
const NAIL_RISE = 44;
/** The hammer's handle end: it swings around this point, this far right of the nail */
const PIVOT_DX = 92;

/** A swing blocks new strikes for this long; the blow lands partway through */
const SWING_MS = 380;
const SWING_REDUCED_MS = 160;
const IMPACT_MS = 120;
const HINT_MS = 1100;

interface Swing {
  nail: number;
  hit: boolean;
  n: number;
}

/**
 * Hit the Nail scavenging mini-game: three rusty nails, a hammer and a timing bar. Strike
 * (click the board, the Strike button, or Space / Enter) while the brass pointer is over the
 * green zone to drive the nail flush. Cozy has a wide zone and endless tries; Challenge a
 * narrow zone, a quicker pointer on nails 2–3 and three misses. "Secured!" offers Continue;
 * × / Escape cancel.
 */
export default function HitTheNailGame({
  mode,
  title = 'Hit the Nail',
  allowRetryOnLoss = true,
  onComplete,
  onCancel,
}: MiniGameProps) {
  const reduceMotion = useGameStore((s) => s.reduceMotion);
  const uid = `nail${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [game, setGame] = useState<NailState>(() => createNailState(mode));
  const [swing, setSwing] = useState<Swing | null>(null);
  const [hint, setHint] = useState<{ text: string; n: number } | null>(null);
  const gameRef = useRef(game);
  const cardRef = useRef<HTMLElement>(null);
  const pointerRef = useRef<HTMLSpanElement>(null);
  /** When the current sweep started (performance.now), and whether the pointer is frozen mid-swing */
  const sweepStart = useRef(0);
  const frozen = useRef(false);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const seq = useRef(0);

  const finished = game.status !== 'playing';
  const left = missesLeft(game);
  const hammerNail = Math.min(swing ? swing.nail : game.driven, NAIL_COUNT - 1);

  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  };

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const id of pending) clearTimeout(id);
      pending.clear();
    };
  }, []);

  const markerNow = (): Marker => markerAt(performance.now() - sweepStart.current, sweepMs(mode, gameRef.current.driven));

  /* The pointer glides via rAF straight on the DOM (no re-render per frame); it stops once the game ends */
  useEffect(() => {
    if (finished) return;
    let raf = 0;
    sweepStart.current = performance.now();
    const frame = () => {
      if (!frozen.current && pointerRef.current) {
        const m = markerAt(performance.now() - sweepStart.current, sweepMs(mode, gameRef.current.driven));
        pointerRef.current.style.left = `${(m.pos * 100).toFixed(2)}%`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [finished, mode]);

  const strike = () => {
    const before = gameRef.current;
    if (before.status !== 'playing' || frozen.current) return;
    const marker = markerNow();
    const { state, result } = strikeNail(before, marker);
    if (result === 'invalid') return;

    const hit = result === 'hit';
    const n = ++seq.current;
    const swingMs = reduceMotion ? SWING_REDUCED_MS : SWING_MS;
    frozen.current = true;
    setSwing({ nail: before.driven, hit, n });

    later(
      () => {
        if (hit) playNailClang();
        else playNailTink();
        if (state.status === 'win') later(playNailFinish, 220);
        if (state.status === 'loss') later(playLocked, 200);
        gameRef.current = state;
        setGame(state);
        if (!hit) setHint({ text: result === 'early' ? 'Too early' : 'Too late', n });
      },
      reduceMotion ? 0 : IMPACT_MS,
    );
    later(() => {
      setSwing(null);
      frozen.current = false;
      sweepStart.current = performance.now();
    }, swingMs);
  };

  useEffect(() => {
    if (!hint) return;
    const id = setTimeout(() => setHint(null), HINT_MS);
    return () => clearTimeout(id);
  }, [hint]);

  /* Space / Enter strike (unless a button has focus — it clicks itself) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[role="dialog"]') && !cardRef.current?.contains(t)) return;
      if ((e.key === ' ' || e.key === 'Enter') && t?.tagName !== 'BUTTON' && t?.tagName !== 'INPUT') {
        e.preventDefault();
        strike();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    cardRef.current?.querySelector<HTMLButtonElement>('.ows-nail-strike')?.focus();
  }, []);

  const playAgain = () => {
    playClick();
    const fresh = createNailState(mode);
    gameRef.current = fresh;
    setGame(fresh);
    setSwing(null);
    setHint(null);
    frozen.current = false;
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
    statusText = 'Secured!';
    statusMod = 'win';
  } else if (game.status === 'loss') {
    statusText = allowRetryOnLoss ? 'Too many misses' : 'Too many misses — try again tomorrow';
    statusMod = 'loss';
  } else if (hint) {
    statusText = hint.text;
    statusMod = 'loss';
  } else {
    statusText = 'Strike when the pointer is in the green';
    statusMod = 'turn';
  }

  const hammerX = NAIL_X[hammerNail];
  /* The hammer face rests just above the active nail's head */
  const headTop = SURFACE_Y - NAIL_RISE - 6;

  return (
    <div className="ows-mg-overlay">
      <section
        ref={cardRef}
        className="ows-mg-card ows-nail-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
      >
        <header className="ows-mg-header">
          <h2 id={`${uid}-title`} className="ows-mg-title">
            {title}
          </h2>
          <span className="ows-nail-progress" aria-label={`${game.driven} of ${NAIL_COUNT} nails driven`}>
            {game.driven} / {NAIL_COUNT}
          </span>
          <span className={`ows-mg-badge ows-mg-badge--${mode}`}>{MODE_LABEL[mode]}</span>
          <button type="button" className="ows-mg-close" aria-label="Close" onMouseEnter={playHover} onClick={close}>
            ×
          </button>
        </header>

        <p className={`ows-mg-status ows-mg-status--${statusMod}`} role="status" aria-live="polite">
          {statusText}
          {left !== null && !finished && (
            <span className="ows-nail-misses">
              {' '}
              · {left} {left === 1 ? 'miss' : 'misses'} left
            </span>
          )}
        </p>

        <svg
          className="ows-nail-board"
          viewBox="0 0 400 190"
          role="button"
          tabIndex={-1}
          aria-label="Strike the nail"
          onClick={() => strike()}
        >
          <defs>
            <linearGradient id={`${uid}-iron`} x1="0" x2="1">
              <stop offset="0" stopColor="#5b524c" />
              <stop offset="0.45" stopColor="#9a8f86" />
              <stop offset="1" stopColor="#4a423d" />
            </linearGradient>
            <linearGradient id={`${uid}-wood`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#b98754" />
              <stop offset="1" stopColor="#8c5e34" />
            </linearGradient>
            {/* Shafts vanish into the wood at the surface line */}
            <clipPath id={`${uid}-surface`}>
              <rect x={0} y={0} width={400} height={SURFACE_Y + 1} />
            </clipPath>
          </defs>

          {/* Plank top surface */}
          <path d="M18 104 L382 104 L392 124 L8 124 Z" fill="#c99a63" stroke="#3a281b" strokeWidth={3} strokeLinejoin="round" />
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${30 + i * 8} ${108 + i * 5} Q200 ${104 + i * 6} ${370 - i * 8} ${108 + i * 5}`} stroke="rgba(90, 58, 32, 0.28)" strokeWidth={1.5} fill="none" />
          ))}

          {/* Nails (shafts are clipped where they enter the wood) */}
          {NAIL_X.map((x, i) => {
            const driven = i < game.driven;
            const rattling = hint && !swing && i === game.driven;
            return (
              <g key={i} className={`ows-nail ${driven ? 'ows-nail--driven' : ''}`}>
                <g key={rattling ? hint.n : 'still'} className={rattling ? 'ows-nail-rattle' : undefined}>
                  <g clipPath={`url(#${uid}-surface)`}>
                    <g className="ows-nail-body" style={{ transform: `translateY(${driven ? NAIL_RISE : 0}px)` }}>
                      <rect x={x - 3.5} y={SURFACE_Y - NAIL_RISE} width={7} height={NAIL_RISE + 4} fill={`url(#${uid}-iron)`} stroke="#2e2622" strokeWidth={1.5} />
                      <rect x={x - 3.5} y={SURFACE_Y - NAIL_RISE + 14} width={7} height={9} fill="rgba(162, 97, 58, 0.55)" />
                    </g>
                  </g>
                  <g className="ows-nail-body" style={{ transform: `translateY(${driven ? NAIL_RISE : 0}px)` }}>
                    <ellipse cx={x} cy={SURFACE_Y - NAIL_RISE - 2} rx={11} ry={4.5} fill="#7d7068" stroke="#2e2622" strokeWidth={2} />
                    <ellipse cx={x - 3} cy={SURFACE_Y - NAIL_RISE - 3} rx={4} ry={1.4} fill="rgba(255, 255, 255, 0.25)" />
                  </g>
                </g>
              </g>
            );
          })}

          {/* Plank front face */}
          <path d="M8 124 L392 124 L392 178 Q392 184 386 184 L14 184 Q8 184 8 178 Z" fill={`url(#${uid}-wood)`} stroke="#3a281b" strokeWidth={3} strokeLinejoin="round" />
          {[138, 152, 168].map((y, i) => (
            <path key={y} d={`M14 ${y} Q120 ${y - 4 + i * 2} 220 ${y + 1} T388 ${y - 1}`} stroke="rgba(60, 36, 16, 0.3)" strokeWidth={1.4} fill="none" />
          ))}

          {/* Dust puff where the blow lands */}
          {swing?.hit && (
            <g key={`dust-${swing.n}`} className="ows-nail-dust" style={{ transform: `translate(${NAIL_X[swing.nail]}px, ${SURFACE_Y}px)` }}>
              {[-14, -6, 4, 13].map((dx, k) => (
                <circle key={k} cx={dx} cy={-2} r={3 + (k % 2)} className="ows-nail-dust__mote" style={{ animationDelay: `${IMPACT_MS + k * 20}ms` }} />
              ))}
            </g>
          )}

          {/* The hammer, poised over the active nail; it swings around its handle end */}
          {!finished || swing ? (
            <g style={{ transform: `translate(${hammerX + PIVOT_DX}px, ${headTop - 11}px)` }} className="ows-nail-hammer-pos">
              <g key={swing ? `s${swing.n}` : 'rest'} className={`ows-nail-hammer ${swing ? 'ows-nail-hammer--swing' : ''}`}>
                <g transform={`translate(${-PIVOT_DX} 0)`}>
                  <rect x={4} y={-5} width={PIVOT_DX + 4} height={10} rx={4} fill="#a8743f" stroke="#3a281b" strokeWidth={2.5} />
                  <rect x={PIVOT_DX - 22} y={-6} width={26} height={12} rx={4} fill="#6e4526" stroke="#3a281b" strokeWidth={2} />
                  <path d="M-17 -11 L17 -11 L19 -6 L19 6 L17 11 L-17 11 L-20 4 L-20 -4 Z" fill={`url(#${uid}-iron)`} stroke="#2e2622" strokeWidth={2.5} strokeLinejoin="round" />
                  <path d="M-15 -8 L12 -8" stroke="rgba(255, 255, 255, 0.3)" strokeWidth={2} />
                </g>
              </g>
            </g>
          ) : null}
        </svg>

        {/* Timing bar */}
        <div className="ows-nail-bar" aria-hidden="true">
          <span className="ows-nail-zone" style={{ left: `${game.zone.start * 100}%`, width: `${game.zone.width * 100}%` }} />
          <span ref={pointerRef} className={`ows-nail-pointer ${finished ? 'ows-nail-pointer--still' : ''}`} />
        </div>

        {finished ? (
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
        ) : (
          <footer className="ows-mg-footer">
            <button type="button" className="ows-mg-btn ows-mg-btn--primary ows-nail-strike" onClick={() => strike()}>
              Strike
            </button>
          </footer>
        )}
      </section>
    </div>
  );
}
