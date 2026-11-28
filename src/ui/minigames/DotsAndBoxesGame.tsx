import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { MiniGameProps } from '../../game/minigames/types.ts';
import {
  allEdges,
  applyEdgeMove,
  chooseDotsCpuMove,
  createDotsState,
  dotsStatus,
  edgeKey,
  edgeOwner,
  type DotsEdge,
  type DotsState,
  type DotsStatus,
} from '../../game/minigames/dotsAndBoxes.ts';
import { useGameStore } from '../../game/store/useGameStore.ts';
import { playBoxChime, playClaim, playClick, playHover, playLocked } from '../../game/audio/soundEngine.ts';
import { miniGameClose, useMiniGameEscape } from './miniGameClose.ts';

/** A natural beat between the opponent's lines, so a chain of boxes can be followed one by one */
const CPU_DELAY_MS = 340;
const CPU_DELAY_REDUCED_MS = 110;
/** How long "Extra turn!" lingers after you close a box */
const EXTRA_TURN_FLASH_MS = 1200;

/** One box in SVG units, and the margin around the outer dots */
const S = 100;
const M = 22;

const OPPONENT = 'Camp';

const RESULT_TEXT: Record<Exclude<DotsStatus, 'playing'>, string> = {
  win: 'You won!',
  draw: 'A quiet draw',
  loss: 'Almost — try again',
};

const MODE_LABEL = { cozy: 'Cozy', challenge: 'Challenge' } as const;

function edgeCoords(e: DotsEdge): { x1: number; y1: number; x2: number; y2: number } {
  const x1 = M + e.col * S;
  const y1 = M + e.row * S;
  return e.dir === 'h' ? { x1, y1, x2: x1 + S, y2: y1 } : { x1, y1, x2: x1, y2: y1 + S };
}

/** Each line owns the diamond between its two dots and the two box centres — together they tile the board, so every tap lands on the nearest line */
function hitDiamond(e: DotsEdge): string {
  const { x1, y1, x2, y2 } = edgeCoords(e);
  const xm = (x1 + x2) / 2;
  const ym = (y1 + y2) / 2;
  const h = S / 2;
  return e.dir === 'h'
    ? `${x1},${y1} ${xm},${ym - h} ${x2},${y2} ${xm},${ym + h}`
    : `${x1},${y1} ${xm + h},${ym} ${x2},${y2} ${xm - h},${ym}`;
}

function edgeLabel(e: DotsEdge): string {
  return e.dir === 'h'
    ? `Horizontal line, row ${e.row + 1}, between dots ${e.col + 1} and ${e.col + 2}`
    : `Vertical line, column ${e.col + 1}, between dots ${e.row + 1} and ${e.row + 2}`;
}

/**
 * Dots & Lines (Dots and Boxes) scavenging mini-game: take turns drawing a line between
 * two neighbouring dots; closing a box claims it and earns another turn. Cozy is a 4×4-dot
 * board against a relaxed opponent, Challenge a 5×5-dot board against a tactical one.
 * Finishing offers Play Again or Continue; × / Escape cancel.
 */
export default function DotsAndBoxesGame({
  mode,
  title = 'Dots & Lines',
  allowRetryOnLoss = true,
  onComplete,
  onCancel,
}: MiniGameProps) {
  const reduceMotion = useGameStore((s) => s.reduceMotion);
  const uid = `dots${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [game, setGame] = useState<DotsState>(() => createDotsState(mode));
  /* Bumped each time the player closes a box, cleared after a moment */
  const [flash, setFlash] = useState(0);
  const [round, setRound] = useState(0);
  const cardRef = useRef<HTMLElement>(null);

  const status = dotsStatus(game);
  const finished = status !== 'playing';
  const cpuTurn = game.turn === 'cpu' && !finished;
  const { size, lastMove } = game;
  const span = size * S + M * 2;

  /* The opponent draws one line per beat — a chain of boxes plays out step by step */
  useEffect(() => {
    if (!cpuTurn) return;
    const timer = setTimeout(() => {
      const r = applyEdgeMove(game, chooseDotsCpuMove(game, mode));
      if (!r) return;
      if (dotsStatus(r.state) === 'playing') {
        if (r.completedBoxes.length > 0) playBoxChime();
        else playClick();
      }
      setGame(r.state);
    }, reduceMotion ? CPU_DELAY_REDUCED_MS : CPU_DELAY_MS);
    return () => clearTimeout(timer);
  }, [cpuTurn, game, mode, reduceMotion]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(0), EXTRA_TURN_FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  /* A warm chime for a win, a soft muted note for a loss */
  useEffect(() => {
    if (status === 'win') playClaim();
    else if (status === 'loss') playLocked();
  }, [status]);


  /* Keyboard players start on the board, and land back on it when their turn returns */
  useEffect(() => {
    if (game.turn !== 'player' || finished) return;
    const active = document.activeElement;
    if (active && active !== document.body && cardRef.current?.contains(active)) return;
    cardRef.current?.querySelector<SVGGElement>('.ows-dots-edge')?.focus();
  }, [game.turn, finished, round]);

  const play = (edge: DotsEdge) => {
    if (cpuTurn || finished || game.turn !== 'player') return;
    const r = applyEdgeMove(game, edge);
    if (!r) return;
    const over = dotsStatus(r.state) !== 'playing';
    if (r.completedBoxes.length > 0) {
      if (!over) {
        playBoxChime();
        setFlash((n) => n + 1);
      }
    } else {
      playClick();
      setFlash(0);
    }
    setGame(r.state);
  };

  const onEdgeKey = (e: ReactKeyboardEvent<SVGGElement>, edge: DotsEdge) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      play(edge);
    }
  };

  const playAgain = () => {
    playClick();
    setGame(createDotsState(mode));
    setFlash(0);
    setRound((r) => r + 1);
  };

  const finish = () => {
    if (!finished) return;
    playClick();
    onComplete({ outcome: status, mode });
  };

  /* Once finished, × / Escape report the result like Continue */
  const close = miniGameClose(finished, finish, onCancel);
  useMiniGameEscape(close);

  const lostLocked = status === 'loss' && !allowRetryOnLoss;
  const cpuChaining = cpuTurn && lastMove?.by === 'cpu' && lastMove.completed.length > 0;
  let statusText: string;
  let statusMod: string;
  if (finished) {
    statusText = lostLocked ? 'Try again tomorrow' : RESULT_TEXT[status];
    statusMod = status;
  } else if (cpuTurn) {
    statusText = cpuChaining ? `${OPPONENT} takes another turn…` : 'Thinking…';
    statusMod = 'thinking';
  } else if (flash) {
    statusText = 'Extra turn!';
    statusMod = 'extra';
  } else {
    statusText = 'Your turn — draw a line';
    statusMod = 'turn';
  }

  const edges = allEdges(size);
  const freshKey = lastMove?.by === 'cpu' ? edgeKey(lastMove.edge) : null;
  const markR = S * 0.17;

  return (
    <div className="ows-mg-overlay">
      <section
        ref={cardRef}
        className={`ows-mg-card ows-dots-card ows-dots-card--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
      >
        <header className="ows-mg-header">
          <h2 id={`${uid}-title`} className="ows-mg-title">
            {title}
          </h2>
          <span className="ows-dots-score" aria-label={`Score: you ${game.playerScore}, ${OPPONENT} ${game.cpuScore}`}>
            <span className="ows-dots-score__you">You {game.playerScore}</span>
            <span aria-hidden="true"> · </span>
            <span className="ows-dots-score__cpu">
              {game.cpuScore} {OPPONENT}
            </span>
          </span>
          <span className={`ows-mg-badge ows-mg-badge--${mode}`}>{MODE_LABEL[mode]}</span>
          <button type="button" className="ows-mg-close" aria-label="Close" onMouseEnter={playHover} onClick={close}>
            ×
          </button>
        </header>

        <p className={`ows-mg-status ows-mg-status--${statusMod}`} role="status" aria-live="polite">
          {statusText}
        </p>

        <div className="ows-dots-body">
          <div className="ows-dots-board">
            <svg key={round} viewBox={`0 0 ${span} ${span}`} role="group" aria-label="Dots and lines board">
              {game.boxes.map((row, r) =>
                row.map((owner, c) => {
                  if (!owner) return null;
                  const cx = M + c * S + S / 2;
                  const cy = M + r * S + S / 2;
                  return (
                    <g key={`b${r}-${c}`} className={`ows-dots-claim ows-dots-claim--${owner}`}>
                      <rect className="ows-dots-box" x={M + c * S + 4} y={M + r * S + 4} width={S - 8} height={S - 8} rx={6} />
                      {owner === 'player' ? (
                        <>
                          <path className="ows-dots-mark" pathLength={1} d={`M${cx - markR} ${cy - markR + 1} Q${cx - 2} ${cy + 2} ${cx + markR} ${cy + markR}`} />
                          <path className="ows-dots-mark ows-dots-mark--late" pathLength={1} d={`M${cx + markR} ${cy - markR} Q${cx + 1} ${cy - 2} ${cx - markR + 1} ${cy + markR}`} />
                        </>
                      ) : (
                        <circle className="ows-dots-mark" pathLength={1} cx={cx} cy={cy} r={markR} />
                      )}
                    </g>
                  );
                }),
              )}

              {edges.map((e) => {
                const owner = edgeOwner(game, e);
                if (!owner) return null;
                const key = edgeKey(e);
                return (
                  <line
                    key={key}
                    pathLength={1}
                    {...edgeCoords(e)}
                    className={`ows-dots-line ows-dots-line--${owner} ${key === freshKey ? 'ows-dots-line--fresh' : ''}`}
                  />
                );
              })}

              {edges.map((e) => {
                if (edgeOwner(game, e)) return null;
                const idle = cpuTurn || finished;
                return (
                  <g
                    key={edgeKey(e)}
                    className="ows-dots-edge"
                    role="button"
                    tabIndex={idle ? -1 : 0}
                    aria-disabled={idle}
                    aria-label={edgeLabel(e)}
                    onClick={() => play(e)}
                    onKeyDown={(ev) => onEdgeKey(ev, e)}
                  >
                    <polygon className="ows-dots-hit" points={hitDiamond(e)} />
                    <line className="ows-dots-preview" {...edgeCoords(e)} />
                  </g>
                );
              })}

              {Array.from({ length: (size + 1) * (size + 1) }, (_, i) => (
                <circle
                  key={i}
                  className="ows-dots-dot"
                  cx={M + (i % (size + 1)) * S}
                  cy={M + Math.floor(i / (size + 1)) * S}
                  r={size > 3 ? 6.5 : 6}
                />
              ))}
            </svg>
          </div>

          <div className="ows-dots-side">
            <p className="ows-mg-legend" aria-hidden="true">
              <span className="ows-mg-legend__x">✕ You</span>
              <span className="ows-mg-legend__o">◯ {OPPONENT}</span>
            </p>
            {finished && (
              <footer className="ows-mg-footer">
                {(allowRetryOnLoss || status === 'draw') && (
                  <button type="button" className="ows-mg-btn" onMouseEnter={playHover} onClick={playAgain}>
                    Play Again
                  </button>
                )}
                <button type="button" className="ows-mg-btn ows-mg-btn--primary" onMouseEnter={playHover} onClick={finish}>
                  Continue
                </button>
              </footer>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
