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
