import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import type { ResourceId } from '../game/types/game.ts';
import type { AssignableStationId, StationConfig } from '../game/data/scenes/types.ts';
import type { DayPhase, Weather } from '../game/types/game.ts';
import { RESOURCE_MAP } from '../game/data/resources.ts';
import { canAfford } from '../game/engine/progression.ts';
import {
  barrelCollect,
  nextStationTier,
  planterHarvest,
  stationTierConfig,
} from '../game/engine/stations.ts';
import type { SceneStationState } from '../game/renderer/shelterScene.ts';
import { playClick, playHover, playLocked } from '../game/audio/soundEngine.ts';
import { useKeepInView } from './keepInView.ts';

export type StationMenuAction = 'primary' | 'sit' | 'extinguish' | 'upgrade';

export interface PropActionMenuProps {
  station: StationConfig;
  anchor: { x: number; y: number };
  dayPhase: DayPhase;
  /** Rain adds a bonus to the barrel's yield */
  weather: Weather;
  stationState: SceneStationState;
  resources: Record<ResourceId, number>;
  onAction: (stationId: string, action: StationMenuAction) => boolean;
  onClose: () => void;
}

const MENU_HALF_WIDTH = 185;
const FLIP_BELOW_Y = 148;

/** Close on Escape or a pointer press outside the menu */
function useMenuDismiss(rootRef: RefObject<HTMLDivElement | null>, onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [rootRef, onClose]);
}

/** Anchor above the prop (or below it near the top of the screen), kept on-screen */
function menuStyle(anchor: { x: number; y: number }): CSSProperties {
  const below = anchor.y < FLIP_BELOW_Y;
  return {
    left: `clamp(${MENU_HALF_WIDTH + 10}px, ${anchor.x}px, calc(100% - ${MENU_HALF_WIDTH + 10}px))`,
    top: below ? anchor.y + 62 : anchor.y - 12,
    transform: below ? 'translateX(-50%)' : 'translate(-50%, -100%)',
  };
}

function CostInline({
  cost,
  resources,
}: {
  cost: Partial<Record<ResourceId, number>>;
  resources: Record<ResourceId, number>;
}) {
  const entries = Object.entries(cost) as [ResourceId, number][];
  if (entries.length === 0) return null;
  return (
    <span className="ows-prop-menu__cost">
      {entries.map(([id, n]) => (
        <span key={id} className={(resources[id] ?? 0) < n ? 'ows-cost-short' : undefined}>
          {n}
          {RESOURCE_MAP[id]?.emoji}
        </span>
      ))}
    </span>
  );
}

function missingHint(
  cost: Partial<Record<ResourceId, number>>,
  resources: Record<ResourceId, number>,
): string {
  const missing = (Object.entries(cost) as [ResourceId, number][])
    .filter(([id, n]) => (resources[id] ?? 0) < n)
    .map(([id, n]) => `${n - (resources[id] ?? 0)} ${RESOURCE_MAP[id]?.emoji ?? id}`);
  return missing.length ? `Need ${missing.join(' ')} more` : '';
}

function formatYields(gains: Partial<Record<ResourceId, number>>): string {
  return (Object.entries(gains) as [ResourceId, number][])
    .filter(([, v]) => v > 0)
    .map(([id, v]) => `+${v}${RESOURCE_MAP[id]?.emoji ?? id}`)
    .join(' ');
}

/**
 * PropActionMenu — Compact, frosted in-world contextual pill anchored above
 * a clicked rooftop station or empty blueprint spot.
 */
export default function PropActionMenu({
  station,
  anchor,
  dayPhase,
  weather,
  stationState,
  resources,
  onAction,
  onClose,
}: PropActionMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useMenuDismiss(rootRef, onClose);
  useKeepInView(rootRef, anchor.x, anchor.y);

  const tier = stationState.tiers[station.id] ?? 0;
  const currentCfg = stationTierConfig(station, tier);
  const nextCfg = nextStationTier(station, tier);
  const busy = stationState.pending !== null;

  const style = menuStyle(anchor);

  const trigger = (action: StationMenuAction) => {
    if (onAction(station.id, action)) {
      playClick();
      onClose();
    } else {
      playLocked();
    }
  };

  /* Empty blueprint spot (tier 0) */
  if (!currentCfg && nextCfg) {
    const affordable = canAfford(nextCfg.cost, resources);
    const hint = affordable ? `Craft ${nextCfg.name}` : missingHint(nextCfg.cost, resources);
    return (
      <div
        ref={rootRef}
        className="ows-prop-menu"
        style={style}
        role="dialog"
        aria-label={`Craft ${nextCfg.name}`}
      >
        <div className="ows-prop-menu__title">
          <span>{station.icon}</span>
          <span>{nextCfg.name}</span>
        </div>
        <div className="ows-prop-menu__actions">
          <button
            type="button"
            className="ows-prop-menu__btn ows-prop-menu__btn--upgrade"
            disabled={!affordable || busy}
            title={hint}
            onMouseEnter={affordable && !busy ? playHover : undefined}
            onClick={() => trigger('upgrade')}
          >
            <span>Craft {nextCfg.name}</span>
            <CostInline cost={nextCfg.cost} resources={resources} />
          </button>
        </div>
        {!affordable && <p className="ows-prop-menu__hint">{hint}</p>}
      </div>
    );
  }

  /* Built station */
  const nextAffordable = nextCfg ? canAfford(nextCfg.cost, resources) : false;
  const upgradeHint = nextCfg
    ? nextAffordable
      ? `Upgrade to ${nextCfg.name}`
      : `${nextCfg.name} — ${missingHint(nextCfg.cost, resources)}`
    : '';

  const renderPrimaryButtons = () => {
    switch (station.id) {
      case 'sewing':
        return (
          <button
            type="button"
            className="ows-prop-menu__btn ows-prop-menu__btn--primary"
            disabled={busy}
            onMouseEnter={!busy ? playHover : undefined}
            onClick={() => trigger('primary')}
          >
            <span>🧵 Mend</span>
          </button>
        );
      case 'grill':
        return (
          <button
            type="button"
            className="ows-prop-menu__btn ows-prop-menu__btn--primary"
            disabled={busy}
            onMouseEnter={!busy ? playHover : undefined}
            onClick={() => trigger('primary')}
          >
            <span>🍳 Cook</span>
          </button>
        );
      case 'planter': {
        const ready = stationState.planterReady;
        const yields = formatYields(planterHarvest(tier));
        return (
          <button
            type="button"
            className="ows-prop-menu__btn ows-prop-menu__btn--primary"
            disabled={!ready || busy}
            title={ready ? `Harvest ${yields}` : 'Growing — ready tomorrow'}
            onMouseEnter={ready && !busy ? playHover : undefined}
            onClick={() => trigger('primary')}
          >
            <span>{ready ? `🌱 Harvest ${yields}` : 'Growing — ready tomorrow'}</span>
          </button>
        );
      }
      case 'barrel': {
        const ready = stationState.barrelReady;
        const rainy = weather === 'rain';
        const yields = formatYields(barrelCollect(tier, weather));
        const label = rainy ? `🌧️ Rain-filled — Collect ${yields}` : `💧 Collect ${yields}`;
        return (
          <button
            type="button"
            className="ows-prop-menu__btn ows-prop-menu__btn--primary"
            disabled={!ready || busy}
            title={ready ? (rainy ? `Rain-filled — collect ${yields}` : `Collect ${yields}`) : 'Filling — ready tomorrow'}
            onMouseEnter={ready && !busy ? playHover : undefined}
            onClick={() => trigger('primary')}
          >
            <span>{ready ? label : 'Filling — ready tomorrow'}</span>
          </button>
        );
      }
      case 'shelter': {
        const isNight = dayPhase === 'night';
        return (
          <button
            type="button"
            className="ows-prop-menu__btn ows-prop-menu__btn--primary"
            disabled={busy}
            title={isNight ? 'Sleep until morning' : 'Rest and restore +25 Stamina'}
            onMouseEnter={!busy ? playHover : undefined}
            onClick={() => trigger('primary')}
          >
            <span>{isNight ? '🌙 Sleep' : '☕ Rest'}</span>
          </button>
        );
      }
      case 'firepit': {
        if (!stationState.fireLit) {
          const hasTimber = (resources.timber ?? 0) >= 1;
          return (
            <button
              type="button"
              className="ows-prop-menu__btn ows-prop-menu__btn--primary"
              disabled={!hasTimber || busy}
              title={hasTimber ? 'Light fire pit (1 🪵)' : 'Need 1 🪵 more'}
              onMouseEnter={hasTimber && !busy ? playHover : undefined}
              onClick={() => trigger('primary')}
            >
              <span>🔥 Light</span>
              <CostInline cost={{ timber: 1 }} resources={resources} />
            </button>
          );
        }
        return (
          <>
            <button
              type="button"
              className="ows-prop-menu__btn ows-prop-menu__btn--primary"
              disabled={busy}
              title="Sit beside the warm fire"
              onMouseEnter={!busy ? playHover : undefined}
              onClick={() => trigger('sit')}
            >
              <span>🔥 Sit</span>
            </button>
            <button
              type="button"
              className="ows-prop-menu__btn"
              disabled={busy}
              title="Extinguish fire to save timber"
              onMouseEnter={!busy ? playHover : undefined}
              onClick={() => trigger('extinguish')}
            >
              <span>Extinguish</span>
            </button>
          </>
        );
      }
    }
  };

  return (
    <div
      ref={rootRef}
      className="ows-prop-menu"
      style={style}
      role="dialog"
      aria-label={`${currentCfg?.name ?? station.id} actions`}
    >
      <div className="ows-prop-menu__title">
        <span>{station.icon}</span>
        <span>{currentCfg?.name}</span>
      </div>

      <div className="ows-prop-menu__actions">
        {renderPrimaryButtons()}

        {nextCfg && (
          <button
            type="button"
            className="ows-prop-menu__btn ows-prop-menu__btn--upgrade"
            disabled={!nextAffordable || busy}
            title={upgradeHint}
            onMouseEnter={nextAffordable && !busy ? playHover : undefined}
            onClick={() => trigger('upgrade')}
          >
            <span>Upgrade to {nextCfg.name}</span>
            <CostInline cost={nextCfg.cost} resources={resources} />
          </button>
        )}
      </div>

      {nextCfg && !nextAffordable && (
        <p className="ows-prop-menu__hint">{upgradeHint}</p>
      )}
    </div>
  );
}

export interface SlotBuildMenuProps {
  /** Stations not yet placed in any slot, in display order */
  stations: readonly StationConfig[];
  anchor: { x: number; y: number };
  resources: Record<ResourceId, number>;
  busy: boolean;
  /** Returns false if the scene couldn't start the build */
  onPick: (stationId: AssignableStationId) => boolean;
  onClose: () => void;
}

/**
 * SlotBuildMenu — opened from an empty "Build here" spot: one row per station
 * that hasn't been placed yet (icon, Tier 1 name, cost; dimmed when unaffordable).
 */
export function SlotBuildMenu({ stations, anchor, resources, busy, onPick, onClose }: SlotBuildMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useMenuDismiss(rootRef, onClose);
  useKeepInView(rootRef, anchor.x, anchor.y);

  return (
    <div
      ref={rootRef}
      className="ows-prop-menu"
      style={menuStyle(anchor)}
      role="dialog"
      aria-label="Choose what to build here"
    >
      <div className="ows-prop-menu__title">
        <span>🧰</span>
        <span>Build here</span>
      </div>
      <div className="ows-prop-menu__actions">
        {stations.map((station) => {
          const first = station.tiers[0];
          const id = station.assignableId;
          if (!first || !id) return null;
          const affordable = canAfford(first.cost, resources);
          const hint = affordable ? `Build ${first.name} here` : `${first.name} — ${missingHint(first.cost, resources)}`;
          return (
            <button
              key={station.id}
              type="button"
              className="ows-prop-menu__btn ows-prop-menu__btn--upgrade"
              disabled={!affordable || busy}
              title={hint}
              aria-label={hint}
              onMouseEnter={affordable && !busy ? playHover : undefined}
              onClick={() => {
                if (onPick(id)) {
                  playClick();
                  onClose();
                } else {
                  playLocked();
                }
              }}
            >
              <span>
                {station.icon} {first.name}
              </span>
              <CostInline cost={first.cost} resources={resources} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
