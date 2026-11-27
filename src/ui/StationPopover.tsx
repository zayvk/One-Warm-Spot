import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ResourceId } from '../game/types/game.ts';
import { RESOURCE_MAP } from '../game/data/resources.ts';
import { MENDING_PERKS, RECIPES } from '../game/data/recipes.ts';
import { perkBlocker, recipeBlocker } from '../game/engine/stations.ts';
import type { SceneStationState, StationActionResult } from '../game/renderer/shelterScene.ts';
import { playClick, playHover, playLocked } from '../game/audio/soundEngine.ts';
import { useKeepInView } from './keepInView.ts';

export type PopoverStation = 'grill' | 'sewing';

export interface StationPopoverProps {
  station: PopoverStation;
  /** Station top in canvas-container pixels */
  anchor: { x: number; y: number };
  title: string;
  stationState: SceneStationState;
  resources: Record<ResourceId, number>;
  onCook: (recipeId: string) => StationActionResult;
  onCraft: (perkId: string) => StationActionResult;
  onClose: () => void;
}

const POPOVER_HALF_WIDTH = 150;
/* Below this anchor height there isn't room above the station, so open downward */
const FLIP_BELOW_Y = 300;

function CostList({ cost, resources }: { cost: Partial<Record<ResourceId, number>>; resources: Record<ResourceId, number> }) {
  return (
    <span className="ows-station-pop__cost">
      {(Object.entries(cost) as [ResourceId, number][]).map(([id, n]) => (
        <span key={id} className={(resources[id] ?? 0) < n ? 'ows-cost-short' : undefined}>
          {n}
          {RESOURCE_MAP[id]?.emoji}
        </span>
      ))}
    </span>
  );
}

/** Small frosted Cooking (grill) / Mending (sewing kit) popover anchored above the station */
export default function StationPopover({
  station,
  anchor,
  title,
  stationState,
  resources,
  onCook,
  onCraft,
  onClose,
}: StationPopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useKeepInView(rootRef, anchor.x, anchor.y);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [onClose]);

  const run = (result: StationActionResult) => {
    if (result.ok) {
      playClick();
      onClose();
    } else {
      playLocked();
      setError(result.message);
    }
  };

  const below = anchor.y < FLIP_BELOW_Y;
  const style: CSSProperties = {
    left: `clamp(${POPOVER_HALF_WIDTH + 8}px, ${anchor.x}px, calc(100% - ${POPOVER_HALF_WIDTH + 8}px))`,
    top: below ? anchor.y + 70 : anchor.y - 12,
    transform: below ? 'translateX(-50%)' : 'translate(-50%, -100%)',
  };

  const tiers = stationState.tiers;
  const heading = station === 'grill' ? 'Cooking' : 'Mending';

  return (
    <div
      ref={rootRef}
      className="ows-station-pop"
      style={style}
      role="dialog"
      aria-label={`${heading} — ${title}`}
    >
      <header className="ows-station-pop__header">
        <span>{heading}</span>
        <span className="ows-station-pop__sub">{title}</span>
        <button type="button" className="ows-station-pop__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <ul className="ows-station-pop__list">
        {station === 'grill' &&
          RECIPES.map((r) => {
            const blocker = recipeBlocker(r, { grillTier: tiers.grill, fireLit: stationState.fireLit, resources });
            const locked = tiers.grill < r.minTier;
            const gains = [r.stamina ? `+${r.stamina} ⚡` : '', r.strength ? `+${r.strength} ❤️` : '']
              .filter(Boolean)
              .join(' · ');
            return (
              <li key={r.id} className={`ows-station-pop__row ${locked ? 'ows-station-pop__row--locked' : ''}`}>
                <span className="ows-station-pop__icon" aria-hidden="true">{r.icon}</span>
                <span className="ows-station-pop__body">
                  <span className="ows-station-pop__name">
                    {r.name}
                    {r.needsFire && <span title="Needs a lit fire" aria-label="needs fire"> 🔥</span>}
                  </span>
                  <span className="ows-station-pop__meta">
                    <CostList cost={r.ingredients} resources={resources} />
                    <span className="ows-station-pop__gain">{gains}</span>
                    {locked && blocker && <span className="ows-station-pop__req">{blocker}</span>}
                  </span>
                </span>
                <button
                  type="button"
                  className="ows-station-pop__act"
                  disabled={blocker !== null}
                  title={blocker ?? `Cook ${r.name}`}
                  aria-label={blocker ?? `Cook ${r.name}`}
                  onMouseEnter={blocker ? undefined : playHover}
                  onClick={() => run(onCook(r.id))}
                >
                  {locked ? '🔒' : 'Cook'}
                </button>
              </li>
            );
          })}

        {station === 'sewing' &&
          MENDING_PERKS.map((p) => {
            const crafted = stationState.perks.includes(p.id);
            const blocker = perkBlocker(p, { sewingTier: tiers.sewing, perks: stationState.perks, resources });
            const locked = tiers.sewing < p.minTier;
            return (
              <li key={p.id} className={`ows-station-pop__row ${locked ? 'ows-station-pop__row--locked' : ''}`}>
                <span className="ows-station-pop__icon" aria-hidden="true">{p.icon}</span>
                <span className="ows-station-pop__body">
                  <span className="ows-station-pop__name">{p.name}</span>
                  <span className="ows-station-pop__meta">
                    {!crafted && <CostList cost={p.cost} resources={resources} />}
                    <span className="ows-station-pop__gain">{p.effect}</span>
                    {locked && blocker && <span className="ows-station-pop__req">{blocker}</span>}
                  </span>
                </span>
                <button
                  type="button"
                  className="ows-station-pop__act"
                  disabled={blocker !== null}
                  title={blocker ?? `Craft ${p.name}`}
                  aria-label={blocker ?? `Craft ${p.name}`}
                  onMouseEnter={blocker ? undefined : playHover}
                  onClick={() => run(onCraft(p.id))}
                >
                  {crafted ? '✓' : locked ? '🔒' : 'Craft'}
                </button>
              </li>
            );
          })}
      </ul>

      {error && <p className="ows-station-pop__error" role="status">{error}</p>}
    </div>
  );
}
