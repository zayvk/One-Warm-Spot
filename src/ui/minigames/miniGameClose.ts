import { useEffect, useRef } from 'react';

/**
 * Closing a mini-game (× or Escape). Before the game ends it simply cancels; once it has
 * ended it reports the result exactly like Continue — so a win is never thrown away and a
 * loss on a once-a-day spot can't be dodged by closing the card.
 */
export function miniGameClose(finished: boolean, finish: () => void, cancel: () => void): () => void {
  return finished ? finish : cancel;
}

/** Escape runs the latest `close` (registered once; the handler always sees current state) */
export function useMiniGameEscape(close: () => void): void {
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      latest.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
