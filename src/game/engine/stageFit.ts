/* Where painted 2D stages sit on screen at any window shape */

export interface StageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Normalized (0–1) region of the art that must always stay on screen */
export interface StageSafeArea {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/**
 * Cover-fit art over the view, centred — but never zoom in so far that the safe area
 * is cropped, and slide the framing just enough to keep it in view. On extreme window
 * shapes the art may then stop short of an edge; the caller fills that band softly.
 */
export function fitStage(
  viewW: number,
  viewH: number,
  artW: number,
  artH: number,
  safe?: StageSafeArea | null,
): StageRect {
  let scale = Math.max(viewW / artW, viewH / artH);
  if (safe) {
    scale = Math.min(
      scale,
      viewW / (artW * Math.max(0.01, safe.xMax - safe.xMin)),
      viewH / (artH * Math.max(0.01, safe.yMax - safe.yMin)),
    );
  }
  const width = artW * scale;
  const height = artH * scale;
  if (!safe) return { x: (viewW - width) / 2, y: (viewH - height) / 2, width, height };
  return {
    x: place(viewW, width, safe.xMin, safe.xMax),
    y: place(viewH, height, safe.yMin, safe.yMax),
    width,
    height,
  };
}

/** Centre the art on one axis, then shift the minimum needed to reveal [sMin, sMax] */
function place(view: number, size: number, sMin: number, sMax: number): number {
  const centred = (view - size) / 2;
  if (size <= view) return centred;
  if (centred + sMin * size < 0) return -sMin * size;
  if (centred + sMax * size > view) return view - sMax * size;
  return centred;
}

/** True when the art stops short of the view on some edge (needs a soft fill behind it) */
export function stageLeavesGaps(rect: StageRect, viewW: number, viewH: number): boolean {
  return rect.x > 0.5 || rect.y > 0.5 || rect.x + rect.width < viewW - 0.5 || rect.y + rect.height < viewH - 0.5;
}

/** A point in normalized stage space (0–1 across the painted art) */
export interface StagePoint {
  x: number;
  y: number;
}

/** Normalized stage point → screen pixels (follows the stage through every resize) */
export function stagePointToPx(rect: StageRect, p: StagePoint): StagePoint {
  return { x: rect.x + p.x * rect.width, y: rect.y + p.y * rect.height };
}

/** Screen pixels → normalized stage point */
export function pxToStagePoint(rect: StageRect, px: number, py: number): StagePoint {
  return { x: (px - rect.x) / (rect.width || 1), y: (py - rect.y) / (rect.height || 1) };
}

/* ───── Proportional UI scale ───── */

export const UI_SCALE_MIN = 0.68;
export const UI_SCALE_MAX = 1.22;
/** The window the HUD was designed at (scale 1) */
const UI_REF_W = 1440;
const UI_REF_H = 900;
/** < 1 so the HUD grows / shrinks more gently than the window itself */
const UI_SCALE_CURVE = 0.6;

/**
 * One proportional factor for the HUD, menus and cards: 1 at 1440×900, tightening on tablets and
 * short landscape phones, growing on 1080p / 1440p monitors. The window's tighter axis decides
 * (4:3 tablets are width-bound, ultrawides height-bound) and the result is clamped to
 * [UI_SCALE_MIN, UI_SCALE_MAX] and rounded to 3 decimals so tiny resizes don't thrash styles.
 */
export function uiScaleFor(viewW: number, viewH: number): number {
  if (!(viewW > 0) || !(viewH > 0)) return 1;
  const fit = Math.min(viewW / UI_REF_W, viewH / UI_REF_H);
  const scale = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, fit ** UI_SCALE_CURVE));
  return Math.round(scale * 1000) / 1000;
}

/** Text-heavy surfaces (hover labels, menus, toasts) never drop below a readable size — mirrors `--ui-text-scale` in theme.css */
export function uiTextScaleFor(uiScale: number): number {
  return Math.min(1.2, Math.max(0.9, uiScale));
}

/** Widest HUD frame (width : height) — beyond it the corners pull in toward the scene */
export const HUD_MAX_ASPECT = 2.2;

/** Extra horizontal inset for the corner HUD, in px from each side of the window */
export interface HudFrameInsets {
  left: number;
  right: number;
}

/**
 * Keeps corner HUD clusters on (or beside) the playable stage instead of stranded at the far
 * edges: on ultrawide windows the frame is capped at HUD_MAX_ASPECT, and when the stage leaves
 * soft side bands (very wide windows) the HUD hugs the painting's edges. Top/bottom bands
 * (4:3 tablets) are left alone — the HUD sitting in them keeps it off the art.
 */
export function hudFrameInsets(viewW: number, viewH: number, stage?: StageRect | null): HudFrameInsets {
  const cap = Math.max(0, (viewW - viewH * HUD_MAX_ASPECT) / 2);
  const bandL = stage ? Math.max(0, stage.x) : 0;
  const bandR = stage ? Math.max(0, viewW - (stage.x + stage.width)) : 0;
  return { left: Math.round(Math.max(cap, bandL)), right: Math.round(Math.max(cap, bandR)) };
}

/** Pixi renderer resolution: crisp on HiDPI screens, capped at 2× to spare phone / 4K GPUs */
export function rendererResolution(devicePixelRatio: number | undefined): number {
  const dpr = Number.isFinite(devicePixelRatio) && (devicePixelRatio ?? 0) > 0 ? (devicePixelRatio as number) : 1;
  return Math.min(dpr, 2);
}
