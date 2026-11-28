import { CUTSCENE_ASSETS } from '../game/data/media.ts';

/* Shared pieces of the Terrace lift cutscenes (ride up on arrival, ride down to the lobby); the stage itself is fitted by useBuildingStage */

/** Soft, dimmed full-bleed copy of a painting behind a stage that doesn't reach every edge */
export function StageFill({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{
        position: 'absolute',
        inset: '-6%',
        width: '112%',
        height: '112%',
        objectFit: 'cover',
        filter: 'blur(22px) brightness(0.72)',
      }}
    />
  );
}

/** The transparent doorway cutout in `terrace-lift-frame.webp` (stage %, slightly tucked behind the frame bezel to avoid edge seams) */
const DOORWAY = { left: '35.2%', top: '21.2%', width: '29.6%', height: '66.6%' } as const;
/** Zoom origin for stepping through the doorway */
export const LIFT_DOORWAY_ORIGIN = '50% 54.5%';

const DOOR_EASE = 'cubic-bezier(0.45, 0.05, 0.25, 1)';

/** Two sliding door panels inside the doorway cutout */
export function LiftDoors({ open, reduceMotion }: { open: boolean; reduceMotion: boolean }) {
  const transition = reduceMotion ? 'opacity 400ms ease' : `transform 800ms ${DOOR_EASE}`;
  const panel = (side: 'left' | 'right') => (
    <div
      style={{
        position: 'absolute',
        [side]: 0,
        top: 0,
        /* Slight center overlap avoids subpixel bright hairlines when panels meet */
        width: '50.6%',
        height: '100%',
        transform: open && !reduceMotion ? `translateX(${side === 'left' ? '-100%' : '100%'})` : 'translateX(0)',
        opacity: open && reduceMotion ? 0 : 1,
        transition,
      }}
    >
      <DoorPanel mirrored={side === 'right'} />
    </div>
  );
  return (
    <div style={{ position: 'absolute', ...DOORWAY, overflow: 'hidden' }}>
      {panel('left')}
      {panel('right')}
    </div>
  );
}

/** Lift interior frame (with its transparent doorway) */
export function LiftFrame() {
  return (
    <img
      src={CUTSCENE_ASSETS.terraceLiftFrame}
      alt=""
      draggable={false}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
}

/** Vintage amber floor readout inside the brass indicator box (sized to the fitted stage) */
export function LiftFloorReadout({
  floor,
  reduceMotion,
  stageHeight,
}: {
  floor: string;
  reduceMotion: boolean;
  stageHeight: number;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '50%',
        top: '7.9%',
        transform: 'translate(-50%, -50%)',
        fontFamily: '"Courier New", ui-monospace, monospace',
        fontWeight: 700,
        fontSize: `${Math.round(stageHeight * 0.05)}px`,
        lineHeight: 1,
        color: '#ffc061',
        textShadow:
          '0 0 4px rgba(255, 176, 72, 0.95), 0 0 12px rgba(255, 140, 40, 0.7), 0 0 22px rgba(255, 120, 30, 0.35)',
      }}
    >
      <span
        key={floor}
        style={{
          display: 'inline-block',
          animation: reduceMotion ? undefined : 'owsLiftDigit 160ms ease-out both',
        }}
      >
        {floor}
      </span>
    </div>
  );
}

/** Warm location caption near the bottom of a cutscene */
export function CutsceneCaption({ text, reduceMotion }: { text: string; reduceMotion: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '10%',
        left: 0,
        right: 0,
        zIndex: 6,
        paddingInline: 'var(--space-md)',
        textAlign: 'center',
        pointerEvents: 'none',
        animation: reduceMotion ? 'owsFadeOpacity 400ms ease both' : 'fadeInUp 900ms ease both',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-game-title)',
          fontSize: 'clamp(1.4rem, 3.5vw, 2.2rem)',
          color: '#fff',
          textShadow: '0 2px 16px rgba(61,56,50,0.5), 0 1px 4px rgba(61,56,50,0.3)',
        }}
      >
        {text}
      </p>
    </div>
  );
}

function DoorPanel({ mirrored }: { mirrored: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#7d8a7c',
        backgroundImage: `url(${CUTSCENE_ASSETS.terraceLiftDoor})`,
        backgroundSize: 'cover',
        backgroundPosition: 'left center',
        transform: mirrored ? 'scaleX(-1)' : undefined,
        /* Soft seam shadow where the two panels meet */
        boxShadow: 'inset -3px 0 5px rgba(20, 16, 12, 0.42)',
      }}
    />
  );
}
