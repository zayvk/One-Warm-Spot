import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { MiniGameProps } from '../../game/minigames/types.ts';
import {
  RUMMAGE_ART_SCALE,
  collectTargetItem,
  countFound,
  createRummageState,
  getNextHintTargetId,
  getRummageItem,
  isRummageComplete,
  movePileItem,
  nudgeClutterItem,
  type PileItem,
  type RummageItemId,
  type RummageState,
} from '../../game/minigames/findTheObject.ts';
import { useGameStore } from '../../game/store/useGameStore.ts';
import { playBoxChime, playClaim, playClick, playHover, playRummage } from '../../game/audio/soundEngine.ts';
import { miniGameClose, useMiniGameEscape } from './miniGameClose.ts';
import { RummageArt, RummageIcon } from './rummageIcons.tsx';

const MODE_LABEL = { cozy: 'Cozy', challenge: 'Challenge' } as const;

/** The drawer's SVG space (1.6 : 1 — one unit = a thousandth of the tray height) */
const VIEW_W = 1600;
const VIEW_H = 1000;
/** Pixels a press must travel before it turns into a drag (shorter = a tap) */
const DRAG_THRESHOLD = 6;
const HINT_MS = 1600;

interface PointerTrack {
  pointerId: number;
  id: string;
  isTarget: boolean;
  /** Pointer → item centre offset, in tray fractions */
  offX: number;
  offY: number;
  x0: number;
  y0: number;
  dragging: boolean;
}

/**
 * Find the Object scavenging mini-game: a procedurally piled drawer of salvage. Drag or tap
 * clutter aside to uncover the items on the checklist, then tap each one to collect it.
 * Cozy hides 3 lightly covered targets (with a Hint), Challenge 5 buried deep in a bigger pile.
 * Finishing offers Play Again (a fresh pile) or Continue; × / Escape cancel.
 */
export default function FindTheObjectGame({ mode, title = 'Find the Object', onComplete, onCancel }: MiniGameProps) {
  const reduceMotion = useGameStore((s) => s.reduceMotion);
  const uid = `rum${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [pile, setPile] = useState<RummageState>(() => createRummageState(mode));
  const [round, setRound] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hint, setHint] = useState<{ id: string; n: number } | null>(null);
  const [lastFound, setLastFound] = useState<RummageItemId | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointer = useRef<PointerTrack | null>(null);

  const complete = isRummageComplete(pile);
  const found = countFound(pile);
  const total = pile.targetIds.length;
  const byId = new Map(pile.items.map((it) => [it.instanceId, it]));
  const drawOrder = [...pile.items].sort((a, b) => a.zIndex - b.zIndex);

  useEffect(() => {
    if (complete) playClaim();
  }, [complete]);

  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(null), HINT_MS);
    return () => clearTimeout(timer);
  }, [hint]);


  /** Screen point → tray fractions */
  const toTray = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { x: 0.5, y: 0.5 };
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  };

  const collect = (id: string) => {
    const r = collectTargetItem(pile, id);
    if (!r.collected) return;
    if (!r.complete) playBoxChime();
    setPile(r.state);
    setHint(null);
    setLastFound(byId.get(id)?.itemId ?? null);
  };

  const nudge = (id: string) => {
    playRummage();
    setPile((s) => nudgeClutterItem(s, id));
  };

  /** Tap / Enter on an item: collect a target, scoot clutter aside */
  const activate = (item: PileItem) => {
    if (complete || item.found) return;
    if (item.isTarget) collect(item.instanceId);
    else nudge(item.instanceId);
  };

  const onPointerDown = (e: ReactPointerEvent<SVGGElement>, item: PileItem) => {
    if (complete || item.found || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toTray(e.clientX, e.clientY);
    pointer.current = {
      pointerId: e.pointerId,
      id: item.instanceId,
      isTarget: item.isTarget,
      offX: item.x - p.x,
      offY: item.y - p.y,
      x0: e.clientX,
      y0: e.clientY,
      dragging: false,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<SVGGElement>) => {
    const t = pointer.current;
    if (!t || t.pointerId !== e.pointerId || t.isTarget) return;
    if (!t.dragging) {
      if (Math.hypot(e.clientX - t.x0, e.clientY - t.y0) < DRAG_THRESHOLD) return;
      t.dragging = true;
      setDragId(t.id);
      playRummage();
    }
    const p = toTray(e.clientX, e.clientY);
    setPile((s) => movePileItem(s, t.id, p.x + t.offX, p.y + t.offY));
  };

  const onPointerUp = (e: ReactPointerEvent<SVGGElement>) => {
    const t = pointer.current;
    if (!t || t.pointerId !== e.pointerId) return;
    pointer.current = null;
    setDragId(null);
    if (t.dragging) return;
    const item = byId.get(t.id);
    if (item) activate(item);
  };

  const onPointerCancel = () => {
    pointer.current = null;
    setDragId(null);
  };

  const onItemKey = (e: ReactKeyboardEvent<SVGGElement>, item: PileItem) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate(item);
    }
  };

  const showHint = () => {
    const id = getNextHintTargetId(pile);
    if (!id) return;
    playClick();
    setHint((h) => ({ id, n: (h?.n ?? 0) + 1 }));
  };

  const playAgain = () => {
    playClick();
    setPile(createRummageState(mode));
    setHint(null);
    setLastFound(null);
    setDragId(null);
    pointer.current = null;
    setRound((r) => r + 1);
  };

  const finish = () => {
    if (!complete) return;
    playClick();
    onComplete({ outcome: 'win', mode });
  };

  /* Once finished, × / Escape report the result like Continue */
  const close = miniGameClose(complete, finish, onCancel);
  useMiniGameEscape(close);

  let statusText: string;
  if (complete) statusText = 'Found everything!';
  else if (lastFound) statusText = `Found the ${getRummageItem(lastFound).name}!`;
  else statusText = 'Drag or tap clutter aside, then tap what you’re looking for';

  const hintItem = hint ? byId.get(hint.id) : undefined;

  return (
    <div className="ows-mg-overlay">
      <section className="ows-mg-card ows-rum-card" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`}>
        <header className="ows-mg-header">
          <h2 id={`${uid}-title`} className="ows-mg-title">
            {title}
          </h2>
          <span className="ows-rum-progress" aria-label={`${found} of ${total} items found`}>
            {found} / {total}
          </span>
          <span className={`ows-mg-badge ows-mg-badge--${mode}`}>{MODE_LABEL[mode]}</span>
          <button type="button" className="ows-mg-close" aria-label="Close" onMouseEnter={playHover} onClick={close}>
            ×
          </button>
        </header>

        <div className="ows-rum-body">
          <div className="ows-rum-tray">
            <svg
              key={round}
              ref={svgRef}
              className="ows-rum-svg"
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              role="group"
              aria-label="Rummage drawer"
            >
              {drawOrder.map((item) => {
                const def = getRummageItem(item.itemId);
                const w = def.width * 1000;
                const h = def.height * 1000;
                const cls = [
                  'ows-rum-item',
                  item.isTarget ? 'ows-rum-item--target' : '',
                  item.found ? 'ows-rum-item--found' : '',
                  dragId === item.instanceId ? 'ows-rum-item--dragging' : '',
                ].join(' ');
                return (
                  <g
                    key={item.instanceId}
                    className={cls}
                    style={{ transform: `translate(${item.x * VIEW_W}px, ${item.y * VIEW_H}px) rotate(${item.rotation}deg)` }}
                    role={item.found ? undefined : 'button'}
                    tabIndex={item.found || complete ? -1 : 0}
                    aria-label={def.name}
                    aria-hidden={item.found || undefined}
                    onPointerDown={(e) => onPointerDown(e, item)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                    onLostPointerCapture={onPointerCancel}
                    onKeyDown={(e) => onItemKey(e, item)}
                  >
                    <g className="ows-rum-pop">
                      <g transform={`translate(${-w / 2} ${-h / 2}) scale(${RUMMAGE_ART_SCALE})`}>
                        <RummageArt id={item.itemId} />
                      </g>
                    </g>
                  </g>
                );
              })}

              {pile.items
                .filter((it) => it.found)
                .map((it) => (
                  <circle key={`glint-${it.instanceId}`} className="ows-rum-glint" cx={it.x * VIEW_W} cy={it.y * VIEW_H} r={90} />
                ))}

              {hintItem && !hintItem.found && (
                <circle
                  key={`hint-${hint!.n}`}
                  className={`ows-rum-hint ${reduceMotion ? '' : 'ows-rum-hint--pulse'}`}
                  cx={hintItem.x * VIEW_W}
                  cy={hintItem.y * VIEW_H}
                  r={Math.max(getRummageItem(hintItem.itemId).width, getRummageItem(hintItem.itemId).height) * 620}
                />
              )}
            </svg>
          </div>

          <div className="ows-rum-side">
            <p className={`ows-mg-status ows-mg-status--${complete ? 'win' : lastFound ? 'extra' : 'turn'}`} role="status" aria-live="polite">
              {statusText}
            </p>

            <ul className="ows-rum-list" aria-label="Things to find">
              {pile.targetIds.map((id) => {
                const it = byId.get(id)!;
                const def = getRummageItem(it.itemId);
                return (
                  <li key={id} className={`ows-rum-target ${it.found ? 'ows-rum-target--found' : ''}`}>
                    <RummageIcon id={it.itemId} className="ows-rum-target__icon" />
                    <span className="ows-rum-target__name">{def.name}</span>
                    <span className="ows-rum-target__check" aria-label={it.found ? 'found' : 'not found yet'}>
                      {it.found ? '✓' : ''}
                    </span>
                  </li>
                );
              })}
            </ul>

            {complete ? (
              <footer className="ows-mg-footer">
                <button type="button" className="ows-mg-btn" onMouseEnter={playHover} onClick={playAgain}>
                  Play Again
                </button>
                <button type="button" className="ows-mg-btn ows-mg-btn--primary" onMouseEnter={playHover} onClick={finish}>
                  Continue
                </button>
              </footer>
            ) : (
              mode === 'cozy' && (
                <button type="button" className="ows-rum-hint-btn" onMouseEnter={playHover} onClick={showHint}>
                  Hint
                </button>
              )
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
