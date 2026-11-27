import { useEffect, useRef, useState } from 'react';
import type { MiniGameProps } from '../../game/minigames/types.ts';
import {
  applyMove,
  chooseCpuMove,
  emptyBoard,
  evaluateBoard,
  type BoardStatus,
  type Cell,
} from '../../game/minigames/ticTacToe.ts';
import { useGameStore } from '../../game/store/useGameStore.ts';
import { playClaim, playClick, playHover, playLocked } from '../../game/audio/soundEngine.ts';

/** The opponent takes a calm breath before answering */
const CPU_DELAY_MS = 380;
const CPU_DELAY_REDUCED_MS = 120;

const RESULT_TEXT: Record<Exclude<BoardStatus, 'playing'>, string> = {
  win: 'You won!',
  draw: 'A quiet draw',
  loss: 'Almost — try again',
};

const MODE_LABEL = { cozy: 'Cozy', challenge: 'Challenge' } as const;

/** Cell centres in the board's 300×300 drawing space */
function cellCentre(i: number): { x: number; y: number } {
  return { x: (i % 3) * 100 + 50, y: Math.floor(i / 3) * 100 + 50 };
}

function cellLabel(i: number, cell: Cell): string {
  const where = `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}`;
  if (cell === 'player') return `${where}: your X`;
  if (cell === 'cpu') return `${where}: opponent's O`;
  return `${where}: empty`;
}

/** Hand-painted dusty-terracotta X */
function XMark() {
  return (
    <svg className="ows-ttt-mark ows-ttt-mark--x" viewBox="0 0 100 100" aria-hidden="true">
      <path pathLength={1} d="M25 23 Q47 48 77 78" />
      <path pathLength={1} d="M76 24 Q52 46 24 77" />
    </svg>
  );
}

/** Hand-painted muted-sage O (a loose, not-quite-closed loop) */
function OMark() {
  return (
    <svg className="ows-ttt-mark ows-ttt-mark--o" viewBox="0 0 100 100" aria-hidden="true">
      <path pathLength={1} d="M50 21 C70 20 80 35 79 51 C78 68 65 80 49 79 C32 78 21 66 22 49 C23 34 34 23 46 21" />
    </svg>
  );
}

/**
 * Tic-Tac-Toe scavenging mini-game: you (X) always start against a computer
 * opponent (O) whose skill follows the shelter's mode — Cozy plays casually,
 * Challenge plays sharp. Finishing offers Play Again or Continue; × / Escape cancel.
 */
export default function TicTacToeGame({
  mode,
  title = 'Tic-Tac-Toe',
  allowRetryOnLoss = true,
  onComplete,
  onCancel,
}: MiniGameProps) {
  const reduceMotion = useGameStore((s) => s.reduceMotion);
  const [board, setBoard] = useState<Cell[]>(emptyBoard);
  const [cpuTurn, setCpuTurn] = useState(false);
  /* Bumped on Play Again so the board re-mounts fresh */
  const [round, setRound] = useState(0);
  const cardRef = useRef<HTMLElement>(null);

  const { status, winningLine } = evaluateBoard(board);
  const finished = status !== 'playing';

  /* The opponent answers after a short, calm pause */
  useEffect(() => {
    if (!cpuTurn || finished) return;
    const timer = setTimeout(() => {
      const next = applyMove(board, chooseCpuMove(board, mode), 'cpu');
      if (next) {
        playClick();
        setBoard(next);
      }
      setCpuTurn(false);
    }, reduceMotion ? CPU_DELAY_REDUCED_MS : CPU_DELAY_MS);
    return () => clearTimeout(timer);
  }, [cpuTurn, finished, board, mode, reduceMotion]);

  /* A warm chime for a win, a soft muted note for a loss */
  useEffect(() => {
    if (status === 'win') playClaim();
    else if (status === 'loss') playLocked();
  }, [status]);

  /* Escape closes; keyboard players start on the board */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  useEffect(() => {
    cardRef.current?.querySelector<HTMLButtonElement>('.ows-ttt-cell:not(:disabled)')?.focus();
  }, [round]);

  const play = (i: number) => {
    if (cpuTurn || finished) return;
    const next = applyMove(board, i, 'player');
    if (!next) return;
    playClick();
    setBoard(next);
    if (evaluateBoard(next).status === 'playing') setCpuTurn(true);
  };

  const playAgain = () => {
    playClick();
    setBoard(emptyBoard());
    setCpuTurn(false);
    setRound((r) => r + 1);
  };

  const finish = () => {
    if (!finished) return;
    playClick();
    onComplete({ outcome: status, mode });
  };

  const lostLocked = status === 'loss' && !allowRetryOnLoss;
  const statusText = lostLocked
    ? 'Try again tomorrow'
    : finished
      ? RESULT_TEXT[status]
      : cpuTurn
        ? 'Thinking…'
        : 'Your turn';

  /* The golden stroke runs a little past the first and last cell of the winning line */
  let strike: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (winningLine) {
    const a = cellCentre(winningLine[0]);
    const b = cellCentre(winningLine[2]);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ex = ((b.x - a.x) / len) * 22;
    const ey = ((b.y - a.y) / len) * 22;
    strike = { x1: a.x - ex, y1: a.y - ey, x2: b.x + ex, y2: b.y + ey };
  }

  return (
    <div className="ows-mg-overlay">
      <section
        ref={cardRef}
        className="ows-mg-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ows-ttt-title"
      >
        <header className="ows-mg-header">
          <h2 id="ows-ttt-title" className="ows-mg-title">
            {title}
          </h2>
          <span className={`ows-mg-badge ows-mg-badge--${mode}`}>{MODE_LABEL[mode]}</span>
          <button type="button" className="ows-mg-close" aria-label="Close" onMouseEnter={playHover} onClick={onCancel}>
            ×
          </button>
        </header>

        <p className={`ows-mg-status ows-mg-status--${finished ? status : cpuTurn ? 'thinking' : 'turn'}`} role="status" aria-live="polite">
          {statusText}
        </p>

        <div key={round} className="ows-ttt-board" role="group" aria-label="Tic-Tac-Toe board">
          {board.map((cell, i) => {
            const open = cell === null && !cpuTurn && !finished;
            return (
              <button
                key={i}
                type="button"
                className={`ows-ttt-cell ${winningLine?.includes(i) ? 'ows-ttt-cell--win' : ''}`}
                disabled={!open}
                aria-label={cellLabel(i, cell)}
                onMouseEnter={open ? playHover : undefined}
                onClick={() => play(i)}
              >
                {cell === 'player' && <XMark />}
                {cell === 'cpu' && <OMark />}
              </button>
            );
          })}
          {strike && (
            <svg className="ows-ttt-strike" viewBox="0 0 300 300" aria-hidden="true">
              <line pathLength={1} {...strike} />
            </svg>
          )}
        </div>

        <p className="ows-mg-legend" aria-hidden="true">
          <span className="ows-mg-legend__x">✕ You</span>
          <span className="ows-mg-legend__o">◯ Opponent</span>
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
      </section>
    </div>
  );
}
