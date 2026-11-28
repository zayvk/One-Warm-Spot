import { describe, expect, it, vi } from 'vitest';
import { miniGameClose } from '../../../ui/minigames/miniGameClose.ts';

describe('closing a mini-game card', () => {
  it('cancels while the game is still running', () => {
    const finish = vi.fn();
    const cancel = vi.fn();
    miniGameClose(false, finish, cancel)();
    expect(cancel).toHaveBeenCalledOnce();
    expect(finish).not.toHaveBeenCalled();
  });

  it('reports the result once the game has ended, so a loss or a win is never dodged', () => {
    const finish = vi.fn();
    const cancel = vi.fn();
    miniGameClose(true, finish, cancel)();
    expect(finish).toHaveBeenCalledOnce();
    expect(cancel).not.toHaveBeenCalled();
  });
});
