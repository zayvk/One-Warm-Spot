import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { MiniGameProps } from '../../game/minigames/types.ts';
import {
  countConnected,
  createWireState,
  getWireSpec,
  isWireBoxFixed,
  isWireConnected,
  tryConnectWire,
  type WireId,
  type WireState,
} from '../../game/minigames/connectWires.ts';
import { playBoxChime, playClaim, playClick, playHover, playLocked } from '../../game/audio/soundEngine.ts';

const MODE_LABEL = { cozy: 'Cozy', challenge: 'Challenge' } as const;

/** Muted insulation colours (jacket, darker edge) */
const WIRE_COLORS: Record<WireId, { fill: string; edge: string }> = {
  terracotta: { fill: '#c8775a', edge: '#8f4a30' },
  sage: { fill: '#8fb07f', edge: '#557a4a' },
  ochre: { fill: '#d6a84c', edge: '#94701e' },
  slate: { fill: '#8396a8', edge: '#4a5866' },
  plum: { fill: '#a0739a', edge: '#66405c' },
  teal: { fill: '#62a39c', edge: '#3a6c67' },
};

/* Panel drawing space */
const VB_W = 600;
const ROW = 68;
const PAD_Y = 48;
const LIGHT_X = 22;
const STUB_X = 34;
const BADGE_X = 66;
const POST_X = 130;
/** Pixels a press must travel before it becomes a drag (shorter = a tap) */
const DRAG_THRESHOLD = 6;
/** Releasing a dragged wire within this many units of a post counts as on it */
const SNAP_RADIUS = 46;
const INK = '#1e1b19';

const rowY = (i: number) => PAD_Y + i * ROW;
const mirror = (x: number) => VB_W - x;

/** A gently sagging cord between two points */
function cordPath(x1: number, y1: number, x2: number, y2: number): string {
  const sag = 24 + Math.abs(y2 - y1) * 0.12 + Math.abs(x2 - x1) * 0.04;
  const dx = (x2 - x1) * 0.38;
  return `M${x1} ${y1} C${x1 + dx} ${y1 + sag} ${x2 - dx} ${y2 + sag} ${x2} ${y2}`;
}

function Cord({ d, id, className = '' }: { d: string; id: WireId; className?: string }) {
  const c = WIRE_COLORS[id];
  return (
    <g className={`ows-wire-cord ${className}`}>
      <path d={d} stroke={INK} strokeWidth={15} />
      <path d={d} stroke={c.edge} strokeWidth={11} />
      <path d={d} stroke={c.fill} strokeWidth={8} />
      <path d={d} stroke="rgba(255, 255, 255, 0.32)" strokeWidth={2.5} transform="translate(0 -2)" />
    </g>
  );
}

interface TerminalProps {
  id: WireId;
  side: 'left' | 'right';
  y: number;
  connected: boolean;
  /** Brass gradient id for the posts */
  brass: string;
}

/** Status light, insulated stub, symbol badge and brass post for one terminal */
function TerminalArt({ id, side, y, connected, brass }: TerminalProps) {
  const x = (v: number) => (side === 'left' ? v : mirror(v));
  const c = WIRE_COLORS[id];
  const spec = getWireSpec(id);
  return (
    <>
      <circle className={`ows-wire-light ${connected ? 'ows-wire-light--on' : ''}`} cx={x(LIGHT_X)} cy={y} r={6.5} />
      <line x1={x(STUB_X)} y1={y} x2={x(POST_X)} y2={y} stroke={INK} strokeWidth={17} strokeLinecap="round" />
      <line x1={x(STUB_X)} y1={y} x2={x(POST_X)} y2={y} stroke={c.edge} strokeWidth={13} strokeLinecap="round" />
      <line x1={x(STUB_X)} y1={y} x2={x(POST_X)} y2={y} stroke={c.fill} strokeWidth={10} strokeLinecap="round" />
      <line x1={x(STUB_X + 4)} y1={y - 3} x2={x(POST_X - 8)} y2={y - 3} stroke="rgba(255,255,255,0.3)" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={x(BADGE_X)} cy={y} r={14} fill="#f3e6cc" stroke={INK} strokeWidth={3} />
      <text x={x(BADGE_X)} y={y} className="ows-wire-symbol" fill={c.edge}>
        {spec.symbol}
      </text>
      <circle cx={x(POST_X)} cy={y} r={16} fill={`url(#${brass})`} stroke="#3a281b" strokeWidth={3} />
      <circle cx={x(POST_X)} cy={y} r={5.5} fill="#5a3d22" />
    </>
  );
}

interface PointerTrack {
  pointerId: number;
  left: number;
  x0: number;
  y0: number;
  dragging: boolean;
}

/**
 * Connect the Wires scavenging mini-game: a weathered junction box with colour- and
 * symbol-coded wires on the left and their shuffled terminals on the right. Drag a wire
 * across to its match, or tap a wire then its match (Enter / Space work too). Cozy has
 * 4 wires, Challenge 6. "Wiring restored!" offers Continue; × / Escape cancel.
 */
export default function ConnectWiresGame({ mode, title = 'Connect the Wires', onComplete, onCancel }: MiniGameProps) {
  const uid = `wire${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [game, setGame] = useState<WireState>(() => createWireState(mode));
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ left: number; x: number; y: number } | null>(null);
  const [hoverRight, setHoverRight] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; left: number; right: number; n: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const pointer = useRef<PointerTrack | null>(null);

  const n = game.left.length;
  const vbH = PAD_Y * 2 + (n - 1) * ROW;
  const fixed = isWireBoxFixed(game);
  const done = countConnected(game);

  useEffect(() => {
    if (fixed) playClaim();
  }, [fixed]);

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
    cardRef.current?.querySelector<SVGGElement>('.ows-wire-terminal--left')?.focus();
  }, []);

  /** Screen point → panel units */
  const toPanel = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { x: 0, y: 0 };
    return { x: ((clientX - rect.left) / rect.width) * VB_W, y: ((clientY - rect.top) / rect.height) * vbH };
  };

  /** The unconnected right post nearest a panel point, if close enough */
  const rightPostNear = (x: number, y: number): number | null => {
    let best: number | null = null;
    let bestD = SNAP_RADIUS;
    game.right.forEach((id, j) => {
      if (isWireConnected(game, id)) return;
      const d = Math.hypot(x - mirror(POST_X), y - rowY(j));
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    });
    return best;
  };

  const attempt = (left: number, right: number) => {
    const r = tryConnectWire(game, left, right);
    setSelected(null);
    setFlash((f) => ({ ok: r.matched, left, right, n: (f?.n ?? 0) + 1 }));
    if (r.matched) {
      if (!isWireBoxFixed(r.state)) playBoxChime();
      setGame(r.state);
      setNote(null);
    } else {
      playLocked();
      setNote('Those don’t match — check the colour and symbol');
    }
  };

  const toggleSelect = (i: number) => {
    playClick();
    setNote(null);
    setSelected((s) => (s === i ? null : i));
  };

  const onLeftDown = (e: ReactPointerEvent<SVGGElement>, i: number) => {
    if (fixed || isWireConnected(game, game.left[i]) || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer.current = { pointerId: e.pointerId, left: i, x0: e.clientX, y0: e.clientY, dragging: false };
  };

  const onLeftMove = (e: ReactPointerEvent<SVGGElement>) => {
    const t = pointer.current;
    if (!t || t.pointerId !== e.pointerId) return;
    if (!t.dragging) {
      if (Math.hypot(e.clientX - t.x0, e.clientY - t.y0) < DRAG_THRESHOLD) return;
      t.dragging = true;
      setSelected(null);
      setNote(null);
    }
    const p = toPanel(e.clientX, e.clientY);
    setDrag({ left: t.left, x: p.x, y: p.y });
    setHoverRight(rightPostNear(p.x, p.y));
  };

  const endPointer = () => {
    pointer.current = null;
    setDrag(null);
    setHoverRight(null);
  };

  const onLeftUp = (e: ReactPointerEvent<SVGGElement>) => {
    const t = pointer.current;
    if (!t || t.pointerId !== e.pointerId) return;
    endPointer();
    if (!t.dragging) {
      toggleSelect(t.left);
      return;
    }
    const p = toPanel(e.clientX, e.clientY);
    const target = rightPostNear(p.x, p.y);
    if (target !== null) attempt(t.left, target);
  };

  const onRight = (j: number) => {
    if (fixed || isWireConnected(game, game.right[j])) return;
    if (selected === null) {
      setNote('Pick a wire on the left first');
      return;
    }
    attempt(selected, j);
  };

  const onKey = (e: ReactKeyboardEvent<SVGGElement>, act: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      act();
    }
  };

  const finish = () => {
    if (!fixed) return;
    playClick();
    onComplete({ outcome: 'win', mode });
  };

  let statusText: string;
  let statusMod: string;
  if (fixed) {
    statusText = 'Wiring restored!';
    statusMod = 'win';
  } else if (note) {
    statusText = note;
    statusMod = flash && !flash.ok ? 'loss' : 'turn';
  } else if (selected !== null) {
    statusText = 'Now tap the matching terminal on the right';
    statusMod = 'turn';
  } else {
    statusText = 'Drag each wire to its matching terminal — or tap one, then its match';
    statusMod = 'turn';
  }

  const freshId = flash?.ok ? game.left[flash.left] : null;
  const dragId = drag ? game.left[drag.left] : null;

  return (
    <div className="ows-mg-overlay">
      <section
        ref={cardRef}
        className="ows-mg-card ows-wire-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
      >
        <header className="ows-mg-header">
          <h2 id={`${uid}-title`} className="ows-mg-title">
            {title}
          </h2>
          <span className="ows-wire-progress" aria-label={`${done} of ${n} wires connected`}>
            {done} / {n}
          </span>
          <span className={`ows-mg-badge ows-mg-badge--${mode}`}>{MODE_LABEL[mode]}</span>
          <button type="button" className="ows-mg-close" aria-label="Close" onMouseEnter={playHover} onClick={onCancel}>
            ×
          </button>
        </header>

        <div className="ows-wire-body">
          <svg
            ref={svgRef}
            className={`ows-wire-panel ${fixed ? 'ows-wire-panel--powered' : ''}`}
            viewBox={`0 0 ${VB_W} ${vbH}`}
            style={{ ['--wire-ratio' as string]: `${VB_W / vbH}` }}
            role="group"
            aria-label="Fuse box wiring"
          >
            <defs>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2="0.35" y2="1">
                <stop offset="0" stopColor="#5a5551" />
                <stop offset="0.55" stopColor="#403b37" />
                <stop offset="1" stopColor="#2d2926" />
              </linearGradient>
              <radialGradient id={`${uid}-brass`} cx="0.38" cy="0.35" r="0.7">
                <stop offset="0" stopColor="#f6dc98" />
                <stop offset="0.55" stopColor="#c99d4c" />
                <stop offset="1" stopColor="#7e5a22" />
              </radialGradient>
            </defs>

            {/* Weathered steel back plate: bevel, rivets, scuffs */}
            <rect x={3} y={3} width={VB_W - 6} height={vbH - 6} rx={18} fill={`url(#${uid}-steel)`} stroke={INK} strokeWidth={4} />
            <rect x={12} y={12} width={VB_W - 24} height={vbH - 24} rx={12} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={2} />
            {[
              [20, 20],
              [VB_W - 20, 20],
              [20, vbH - 20],
              [VB_W - 20, vbH - 20],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={5} fill="#77706a" stroke={INK} strokeWidth={2} />
            ))}
            <path d={`M200 ${vbH * 0.3} l60 -14 M330 ${vbH * 0.72} l70 10 M250 ${vbH - 30} l40 -6`} stroke="rgba(255,255,255,0.07)" strokeWidth={2} />
            <text x={VB_W / 2} y={30} className="ows-wire-stamp" aria-hidden="true">
              JUNCTION · 230V
            </text>
            {/* Terminal strips */}
            <rect x={POST_X - 24} y={18} width={48} height={vbH - 36} rx={8} fill="#26221f" stroke={INK} strokeWidth={3} />
            <rect x={mirror(POST_X) - 24} y={18} width={48} height={vbH - 36} rx={8} fill="#26221f" stroke={INK} strokeWidth={3} />

            {/* Joined cords run under the posts */}
            {game.left.map((id, i) => {
              if (!isWireConnected(game, id)) return null;
              const j = game.right.indexOf(id);
              return (
                <Cord
                  key={id}
                  id={id}
                  d={cordPath(POST_X, rowY(i), mirror(POST_X), rowY(j))}
                  className={id === freshId ? 'ows-wire-cord--fresh' : ''}
                />
              );
            })}
            {drag && dragId && (
              <Cord
                id={dragId}
                className="ows-wire-cord--live"
                d={cordPath(
                  POST_X,
                  rowY(drag.left),
                  hoverRight !== null ? mirror(POST_X) : drag.x,
                  hoverRight !== null ? rowY(hoverRight) : drag.y,
                )}
              />
            )}

            {game.left.map((id, i) => {
              const connected = isWireConnected(game, id);
              const spec = getWireSpec(id);
              const shaking = flash && !flash.ok && flash.left === i;
              return (
                <g
                  key={`l-${id}`}
                  className={`ows-wire-terminal ows-wire-terminal--left ${selected === i ? 'ows-wire-terminal--selected' : ''}`}
                  role="button"
                  tabIndex={connected || fixed ? -1 : 0}
                  aria-disabled={connected || fixed}
                  aria-pressed={selected === i}
                  aria-label={`${spec.name} wire with a ${spec.symbolName}${connected ? ', connected' : ''}`}
                  onPointerDown={(e) => onLeftDown(e, i)}
                  onPointerMove={onLeftMove}
                  onPointerUp={onLeftUp}
                  onPointerCancel={endPointer}
                  onLostPointerCapture={() => pointer.current && endPointer()}
                  onKeyDown={(e) => onKey(e, () => !connected && !fixed && toggleSelect(i))}
                >
                  <rect x={6} y={rowY(i) - ROW / 2 + 3} width={POST_X + 34} height={ROW - 6} rx={10} className="ows-wire-hit" />
                  <g key={shaking ? `s${flash?.n}` : 'still'} className={shaking ? 'ows-wire-shake' : undefined}>
                    <TerminalArt id={id} side="left" y={rowY(i)} connected={connected} brass={`${uid}-brass`} />
                  </g>
                  {selected === i && <circle cx={POST_X} cy={rowY(i)} r={24} className="ows-wire-ring" />}
                </g>
              );
            })}

            {game.right.map((id, j) => {
              const connected = isWireConnected(game, id);
              const spec = getWireSpec(id);
              const glowing = flash?.ok && flash.right === j;
              const missed = flash && !flash.ok && flash.right === j;
              return (
                <g
                  key={`r-${id}`}
                  className={`ows-wire-terminal ows-wire-terminal--right ${hoverRight === j || (selected !== null && !connected) ? 'ows-wire-terminal--armed' : ''}`}
                  role="button"
                  tabIndex={connected || fixed ? -1 : 0}
                  aria-disabled={connected || fixed}
                  aria-label={`${spec.name} terminal with a ${spec.symbolName}${connected ? ', connected' : ''}`}
                  onClick={() => onRight(j)}
                  onKeyDown={(e) => onKey(e, () => onRight(j))}
                >
                  <rect x={mirror(POST_X) - 34} y={rowY(j) - ROW / 2 + 3} width={POST_X + 28} height={ROW - 6} rx={10} className="ows-wire-hit" />
                  <TerminalArt id={id} side="right" y={rowY(j)} connected={connected} brass={`${uid}-brass`} />
                  {glowing && <circle key={`g${flash?.n}`} cx={mirror(POST_X)} cy={rowY(j)} r={20} className="ows-wire-glint" />}
                  {missed && <circle key={`m${flash?.n}`} cx={mirror(POST_X)} cy={rowY(j)} r={20} className="ows-wire-miss" />}
                  {hoverRight === j && <circle cx={mirror(POST_X)} cy={rowY(j)} r={24} className="ows-wire-ring" />}
                </g>
              );
            })}
          </svg>

          <div className="ows-wire-side">
            <p className={`ows-mg-status ows-mg-status--${statusMod}`} role="status" aria-live="polite">
              {statusText}
            </p>
            {fixed && (
              <footer className="ows-mg-footer">
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
