/* ───── Scavenging mini-games: the shared contract every puzzle implements ───── */

import type { GameMode } from '../types/game.ts';

/** How a mini-game ended (`cancelled` = closed before finishing) */
export type MiniGameOutcome = 'win' | 'draw' | 'loss' | 'cancelled';

export interface MiniGameResult {
  outcome: MiniGameOutcome;
  /** The shelter's mode the puzzle was played in (sets its difficulty) */
  mode: GameMode;
}

/**
 * Props every mini-game component takes. The host (a future floor / apartment
 * hotspot) turns the result into rewards; the mini-game itself never touches the store's
 * resources.
 */
export interface MiniGameProps {
  /** Difficulty follows the active shelter's mode */
  mode: GameMode;
  /** Optional heading (each game has its own default) */
  title?: string;
  /** Allow Play Again after losing (default `true`; floor scavenging spots pass `false`) */
  allowRetryOnLoss?: boolean;
  /** Finished and the player chose to move on */
  onComplete: (result: MiniGameResult) => void;
  /** Closed early (× / Escape) */
  onCancel: () => void;
}
