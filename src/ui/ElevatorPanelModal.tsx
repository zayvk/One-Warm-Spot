import { useEffect, useRef } from 'react';
import { ELEVATOR_STOPS, type BuildingFloorId } from '../game/data/floors.ts';
import { playClick, playHover } from '../game/audio/soundEngine.ts';

export interface ElevatorPanelModalProps {
  /** The floor the traveler is on (shown lit, not selectable) */
  current: BuildingFloorId;
  onSelect: (floor: BuildingFloorId) => void;
  onClose: () => void;
}

/**
 * Antique brass lift panel: one round glowing button per stop (R, 4, 3, 2, 1).
 * Closes on Cancel, a click outside the panel, or Escape.
 */
export default function ElevatorPanelModal({ current, onSelect, onClose }: ElevatorPanelModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    /* Start keyboard users on the first floor they can travel to */
    panelRef.current?.querySelector<HTMLButtonElement>('.ows-lift-btn:not(:disabled)')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="ows-lift-overlay"
      onPointerDown={(e) => {
        if (!panelRef.current?.contains(e.target as Node)) onClose();
      }}
    >
      <div ref={panelRef} className="ows-lift-panel" role="dialog" aria-modal="true" aria-label="Elevator — choose a floor">
        <div className="ows-lift-panel__plate">
          <span className="ows-lift-panel__screw" aria-hidden="true" />
          <span className="ows-lift-panel__title">Elevator</span>
          <span className="ows-lift-panel__screw" aria-hidden="true" />
        </div>

        <ul className="ows-lift-panel__stops">
          {ELEVATOR_STOPS.map((stop) => {
            const isCurrent = stop.id === current;
            return (
              <li key={stop.id}>
                <button
                  type="button"
                  className={`ows-lift-btn ${isCurrent ? 'ows-lift-btn--current' : ''}`}
                  disabled={isCurrent}
                  aria-label={isCurrent ? `${stop.label} (current floor)` : `Ride to ${stop.label}`}
                  onMouseEnter={isCurrent ? undefined : playHover}
                  onClick={() => {
                    playClick();
                    onSelect(stop.id);
                  }}
                >
                  <span className="ows-lift-btn__disc" aria-hidden="true">
                    {stop.button}
                  </span>
                  <span className="ows-lift-btn__label">{stop.label}</span>
                  {isCurrent && <span className="ows-lift-btn__current">Current</span>}
                </button>
              </li>
            );
          })}
        </ul>

        <button type="button" className="ows-lift-panel__cancel" onClick={onClose} onMouseEnter={playHover}>
          Cancel
        </button>
      </div>
    </div>
  );
}
