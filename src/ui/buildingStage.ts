import { useMemo } from 'react';
import { BUILDING_ART_H, BUILDING_ART_W } from '../game/data/floors.ts';
import { fitStage, stageLeavesGaps, type StageRect, type StageSafeArea } from '../game/engine/stageFit.ts';
import { useViewport } from './useViewport.ts';

/**
 * A painted 1376×768 building stage (rooftop, floors, lift) fitted like every other scene:
 * cover the visible window but never crop `safe`. `fill` is true when the art stops short of an
 * edge (show a soft blurred copy behind it). Pass a stable `safe` object (a constant or memo).
 */
export function useBuildingStage(safe: StageSafeArea): { stage: StageRect; fill: boolean } {
  const { w, h } = useViewport();
  return useMemo(() => {
    const stage = fitStage(w, h, BUILDING_ART_W, BUILDING_ART_H, safe);
    return { stage, fill: stageLeavesGaps(stage, w, h) };
  }, [w, h, safe]);
}

/** Absolute style placing a layer exactly on a fitted stage */
export function stageBox(stage: StageRect): { position: 'absolute'; left: number; top: number; width: number; height: number } {
  return { position: 'absolute', left: stage.x, top: stage.y, width: stage.width, height: stage.height };
}
