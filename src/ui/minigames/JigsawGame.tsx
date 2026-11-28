import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { MiniGameProps } from '../../game/minigames/types.ts';
import {
  JIGSAW_TAB_DEPTH,
  buildPiecePath,
  countPlaced,
  createJigsawState,
  getJigsawImage,
  isSolved,
  pickJigsawImage,
  placePiece,
  type JigsawPiece,
  type JigsawState,
} from '../../game/minigames/jigsaw.ts';
import { JIGSAW_IMAGES } from '../../game/data/media.ts';
import { useGameStore } from '../../game/store/useGameStore.ts';
import { playClaim, playClick, playHover } from '../../game/audio/soundEngine.ts';
import { miniGameClose, useMiniGameEscape } from './miniGameClose.ts';

const MODE_LABEL = { cozy: 'Cozy', challenge: 'Challenge' } as const;

/** Cell size in SVG units; every piece is cut in this space */
const CELL = 100;
/** Room around a cell for tabs poking out (plus the outline stroke) */
const PAD = Math.ceil(JIGSAW_TAB_DEPTH * CELL) + 3;
const PIECE_BOX = CELL + PAD * 2;
/** Pixels a press must travel before it turns into a drag (shorter = a tap) */
const DRAG_THRESHOLD = 6;
/** Dropping within this many cells of a piece's home slot snaps it in */
const SNAP_RADIUS = 0.55;

/* Paintings played this session, so Play Again (and the next visit) brings a fresh one */
const recentIds: string[] = [];
function rememberPlayed(id: string): void {
  const at = recentIds.indexOf(id);
  if (at !== -1) recentIds.splice(at, 1);
  recentIds.push(id);
  // Once everything has been seen, start the rotation over (minus the latest)
  if (recentIds.length >= JIGSAW_IMAGES.length) recentIds.splice(0, recentIds.length - 1);
}

function freshPuzzle(mode: MiniGameProps['mode']): JigsawState {
  return createJigsawState(mode, pickJigsawImage(recentIds).id);
}

interface DragInfo {
  pieceId: number;
  /** On-screen size of one board cell, so the dragged piece matches the board */
  cellPx: number;
  x: number;
  y: number;
}

interface PointerTrack {
  pointerId: number;
  pieceId: number;
  x0: number;
  y0: number;
  dragging: boolean;
}

/** One piece cut from the painting, drawn in its own padded box */
function PieceArt({ piece, gridSize, src, clipId }: { piece: JigsawPiece; gridSize: number; src: string; clipId: string }) {
  const d = buildPiecePath(piece.edges, CELL);
  const full = gridSize * CELL;
  return (
    <svg className="ows-jig-piece-art" viewBox={`${-PAD} ${-PAD} ${PIECE_BOX} ${PIECE_BOX}`} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} className="ows-jig-piece-back" />
      <image
        href={src}
        x={-piece.col * CELL}
        y={-piece.row * CELL}
        width={full}
        height={full}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${clipId})`}
      />
      <path d={d} className="ows-jig-piece-edge" />
    </svg>
  );
}

/**
 * Jigsaw scavenging mini-game: rebuild a painting cut into interlocking pieces —
 * 3×3 in Cozy (with a Peek ghost), 4×4 in Challenge. Drag a piece onto the board, or tap
 * a piece then tap its spot; pieces only lock into their own slot. Finishing offers
 * Play Again (a fresh painting) or Continue; × / Escape cancel.
 */
export default function JigsawGame({ mode, title = 'Jigsaw Puzzle', onComplete, onCancel }: MiniGameProps) {
  const reduceMotion = useGameStore((s) => s.reduceMotion);
  /* Safe inside SVG `url(#…)` references */
  const uid = `jig${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [puzzle, setPuzzle] = useState<JigsawState>(() => freshPuzzle(mode));
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragInfo | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const [snap, setSnap] = useState<{ slot: number; n: number } | null>(null);
  const [nudge, setNudge] = useState<{ piece: number; n: number } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [peek, setPeek] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<PointerTrack | null>(null);
  const suppressClick = useRef(false);

  const image = getJigsawImage(puzzle.imageId) ?? JIGSAW_IMAGES[0];
  const ready = loadedSrc === image.src;
  const { gridSize, pieces } = puzzle;
  const total = pieces.length;
  const placed = countPlaced(puzzle);
  const solved = isSolved(puzzle);
  const full = gridSize * CELL;

  /* Load only the painting this round uses */
  useEffect(() => {
    let alive = true;
    const img = new Image();
    const done = () => {
      if (alive) setLoadedSrc(image.src);
    };
    img.onload = done;
    img.onerror = done;
    img.src = image.src;
    return () => {
      alive = false;
    };
  }, [image.src]);

  useEffect(() => {
    rememberPlayed(puzzle.imageId);
  }, [puzzle.imageId]);


  /* Keyboard players start on the first tray piece */
  useEffect(() => {
    if (ready) cardRef.current?.querySelector<HTMLButtonElement>('.ows-jig-piece')?.focus();
  }, [ready, puzzle.imageId]);

  const attemptPlace = (pieceId: number, slot: number) => {
    const { state, result } = placePiece(puzzle, pieceId, slot);
    if (result === 'placed') {
      setPuzzle(state);
      setSelected(null);
      setHint(null);
      setSnap((s) => ({ slot, n: (s?.n ?? 0) + 1 }));
      if (isSolved(state)) {
        setPeek(false);
        playClaim();
      } else {
        playClick();
      }
    } else if (result === 'wrong') {
      setNudge((n) => ({ piece: pieceId, n: (n?.n ?? 0) + 1 }));
      setHint('Not quite there — try another spot');
    }
  };

  /** Board slot under a screen point (null when off the board) */
  const slotAt = (x: number, y: number): number | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || x < rect.left || y < rect.top || x >= rect.right || y >= rect.bottom) return null;
    const col = Math.floor(((x - rect.left) / rect.width) * gridSize);
    const row = Math.floor(((y - rect.top) / rect.height) * gridSize);
    return row * gridSize + col;
  };

  /** Where a dragged piece lands: its home slot when dropped close enough, else whatever slot is under it */
  const dropTarget = (pieceId: number, x: number, y: number): number | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const cell = rect.width / gridSize;
    const home = pieces[pieceId];
    const hx = rect.left + (home.col + 0.5) * cell;
    const hy = rect.top + (home.row + 0.5) * cell;
    if (Math.hypot(x - hx, y - hy) <= cell * SNAP_RADIUS) return pieceId;
    return slotAt(x, y);
  };

  const moveGhost = (x: number, y: number, cellPx: number) => {
    const size = (cellPx * PIECE_BOX) / CELL;
    if (ghostRef.current) ghostRef.current.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`;
  };

  const endDrag = () => {
    pointer.current = null;
    setDrag(null);
    setHoverSlot(null);
  };

  const onPiecePointerDown = (e: ReactPointerEvent<HTMLButtonElement>, pieceId: number) => {
    suppressClick.current = false;
    if (!ready || solved || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer.current = { pointerId: e.pointerId, pieceId, x0: e.clientX, y0: e.clientY, dragging: false };
  };

  const onPiecePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = pointer.current;
    if (!p || p.pointerId !== e.pointerId) return;
    if (!p.dragging) {
      if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < DRAG_THRESHOLD) return;
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) return;
      p.dragging = true;
      setSelected(null);
      setHint(null);
      setDrag({ pieceId: p.pieceId, cellPx: rect.width / gridSize, x: e.clientX, y: e.clientY });
    } else if (drag) {
      moveGhost(e.clientX, e.clientY, drag.cellPx);
    }
    const over = slotAt(e.clientX, e.clientY);
    const next = over !== null && puzzle.slots[over] === null ? over : null;
    if (next !== hoverSlot) setHoverSlot(next);
  };

  const onPiecePointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = pointer.current;
    if (!p || p.pointerId !== e.pointerId) return;
    const wasDragging = p.dragging;
    endDrag();
    if (!wasDragging) return;
    // The browser still fires a click after a drag — don't let it toggle selection
    suppressClick.current = true;
    const target = dropTarget(p.pieceId, e.clientX, e.clientY);
    if (target !== null) attemptPlace(p.pieceId, target);
  };

  const onPieceLostCapture = () => {
    if (pointer.current) endDrag();
  };

  const onPieceClick = (pieceId: number) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (!ready || solved) return;
    playClick();
    setHint(null);
    setSelected((s) => (s === pieceId ? null : pieceId));
  };

  const onSlotClick = (slot: number) => {
    if (solved || puzzle.slots[slot] !== null) return;
    if (selected === null) {
      setHint('Pick a piece from the tray first');
      return;
    }
    attemptPlace(selected, slot);
  };

  const playAgain = () => {
    playClick();
    setPuzzle(freshPuzzle(mode));
    setSelected(null);
    setSnap(null);
    setNudge(null);
    setHint(null);
    setPeek(false);
  };

  const finish = () => {
    if (!solved) return;
    playClick();
    onComplete({ outcome: 'win', mode });
  };

  /* Once finished, × / Escape report the result like Continue */
  const close = miniGameClose(solved, finish, onCancel);
  useMiniGameEscape(close);

  let statusText: string;
  if (solved) statusText = 'Piece by piece — complete!';
  else if (!ready) statusText = 'Unpacking the pieces…';
  else if (hint) statusText = hint;
  else if (selected !== null) statusText = 'Now tap the spot where it belongs';
  else statusText = 'Drag a piece onto the board — or tap a piece, then its spot';
  const statusMod = solved ? 'win' : ready ? 'turn' : 'thinking';

  const slotTransform = (p: JigsawPiece) => `translate(${p.col * CELL} ${p.row * CELL})`;
  const dragPiece = drag ? pieces[drag.pieceId] : null;
  const ghostSize = drag ? (drag.cellPx * PIECE_BOX) / CELL : 0;

  return (
    <div className="ows-mg-overlay">
      <section
        ref={cardRef}
        className={`ows-mg-card ows-jig-card ows-jig-card--${gridSize}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
      >
        <header className="ows-mg-header">
          <h2 id={`${uid}-title`} className="ows-mg-title">
            {title}
          </h2>
          <span className="ows-jig-progress" aria-label={`${placed} of ${total} pieces placed`}>
            {placed} / {total}
          </span>
          <span className={`ows-mg-badge ows-mg-badge--${mode}`}>{MODE_LABEL[mode]}</span>
          <button type="button" className="ows-mg-close" aria-label="Close" onMouseEnter={playHover} onClick={close}>
            ×
          </button>
        </header>

        <p className={`ows-mg-status ows-mg-status--${statusMod}`} role="status" aria-live="polite">
          {statusText}
        </p>

        <div className="ows-jig-body">
          <div ref={boardRef} className={`ows-jig-board ${solved ? 'ows-jig-board--complete' : ''}`}>
            <svg className="ows-jig-art" viewBox={`0 0 ${full} ${full}`} aria-hidden="true">
              <defs>
                {pieces.map((p) =>
                  puzzle.slots[p.id] !== null ? (
                    <clipPath key={p.id} id={`${uid}-slot-${p.id}`}>
                      <path d={buildPiecePath(p.edges, CELL)} transform={slotTransform(p)} />
                    </clipPath>
                  ) : null,
                )}
              </defs>
              {ready && mode === 'cozy' && peek && !solved && (
                <image className="ows-jig-peek-ghost" href={image.src} width={full} height={full} preserveAspectRatio="xMidYMid slice" />
              )}
              {!solved &&
                pieces.map((p) =>
                  puzzle.slots[p.id] === null ? (
                    <path key={p.id} d={buildPiecePath(p.edges, CELL)} transform={slotTransform(p)} className="ows-jig-slot-outline" />
                  ) : null,
                )}
              {pieces.map((p) =>
                puzzle.slots[p.id] !== null ? (
                  <g key={p.id}>
                    <image
                      href={image.src}
                      width={full}
                      height={full}
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#${uid}-slot-${p.id})`}
                    />
                    {!solved && <path d={buildPiecePath(p.edges, CELL)} transform={slotTransform(p)} className="ows-jig-piece-edge" />}
                  </g>
                ) : null,
              )}
              {snap && !solved && (
                <path
                  key={snap.n}
                  d={buildPiecePath(pieces[snap.slot].edges, CELL)}
                  transform={slotTransform(pieces[snap.slot])}
                  className="ows-jig-shimmer"
                />
              )}
              {solved && <image className="ows-jig-reveal" href={image.src} width={full} height={full} preserveAspectRatio="xMidYMid slice" />}
            </svg>

            <div
              className="ows-jig-slots"
              role="group"
              aria-label="Puzzle board"
              style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
            >
              {pieces.map((p) => {
                const filled = puzzle.slots[p.id] !== null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`ows-jig-slot ${hoverSlot === p.id ? 'ows-jig-slot--hover' : ''} ${selected !== null && !filled ? 'ows-jig-slot--armed' : ''}`}
                    disabled={filled || solved || !ready}
                    aria-label={`Row ${p.row + 1}, column ${p.col + 1}: ${filled ? 'placed' : 'empty'}`}
                    onClick={() => onSlotClick(p.id)}
                  />
                );
              })}
            </div>
          </div>

          <div className="ows-jig-side">
            {solved ? (
              <div className="ows-jig-done">
                <p className="ows-jig-caption">“{image.title}”</p>
                <footer className="ows-mg-footer">
                  <button type="button" className="ows-mg-btn" onMouseEnter={playHover} onClick={playAgain}>
                    Play Again
                  </button>
                  <button type="button" className="ows-mg-btn ows-mg-btn--primary" onMouseEnter={playHover} onClick={finish}>
                    Continue
                  </button>
                </footer>
              </div>
            ) : (
              <>
                <div className={`ows-jig-tray ${ready ? '' : 'ows-jig-tray--loading'}`} role="group" aria-label="Puzzle pieces">
                  {puzzle.tray.map((id, k) => {
                    const piece = pieces[id];
                    const nudged = nudge?.piece === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`ows-jig-piece ${selected === id ? 'ows-jig-piece--selected' : ''} ${drag?.pieceId === id ? 'ows-jig-piece--lifted' : ''}`}
                        disabled={!ready}
                        aria-pressed={selected === id}
                        aria-label={`Puzzle piece ${k + 1}`}
                        onMouseEnter={drag ? undefined : playHover}
                        onPointerDown={(e) => onPiecePointerDown(e, id)}
                        onPointerMove={onPiecePointerMove}
                        onPointerUp={onPiecePointerUp}
                        onPointerCancel={endDrag}
                        onLostPointerCapture={onPieceLostCapture}
                        onClick={() => onPieceClick(id)}
                      >
                        <span key={nudged ? nudge.n : 0} className={`ows-jig-piece-inner ${nudged ? 'ows-jig-piece-inner--nudge' : ''}`}>
                          <PieceArt piece={piece} gridSize={gridSize} src={image.src} clipId={`${uid}-tray-${id}`} />
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="ows-jig-tools">
                  <span className="ows-jig-caption">“{image.title}”</span>
                  {mode === 'cozy' && (
                    <button
                      type="button"
                      className="ows-jig-peek"
                      aria-pressed={peek}
                      disabled={!ready}
                      onMouseEnter={playHover}
                      onClick={() => {
                        playClick();
                        setPeek((v) => !v);
                      }}
                    >
                      Peek
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* The drag ghost sits outside the (scaled) card so its fixed position follows the pointer 1:1 */}
      {drag && dragPiece && (
        <div
          ref={ghostRef}
          className={`ows-jig-ghost ${reduceMotion ? '' : 'ows-jig-ghost--tilt'}`}
          style={{
            width: ghostSize,
            height: ghostSize,
            transform: `translate(${drag.x - ghostSize / 2}px, ${drag.y - ghostSize / 2}px)`,
          }}
          aria-hidden="true"
        >
          <PieceArt piece={dragPiece} gridSize={gridSize} src={image.src} clipId={`${uid}-ghost`} />
        </div>
      )}
    </div>
  );
}
