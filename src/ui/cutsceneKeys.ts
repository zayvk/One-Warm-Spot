/* Which key presses may skip a cutscene */

const SKIP_CODES = new Set(['Space', 'Enter', 'Escape']);
const INTERACTIVE = 'button, input, select, textarea, a[href], [role="switch"], [role="slider"], [contenteditable="true"]';

/**
 * Space / Enter / Escape skip a cutscene — unless the player is using a control
 * (Settings, mute, the Skip button itself) or a dialog is open over the cutscene.
 */
export function isCutsceneSkipKey(e: KeyboardEvent): boolean {
  if (!SKIP_CODES.has(e.code) || e.defaultPrevented || e.repeat) return false;
  const target = e.target instanceof Element ? e.target : null;
  if (target?.closest(INTERACTIVE)) return false;
  if (document.querySelector('[role="dialog"]')) return false;
  return true;
}
