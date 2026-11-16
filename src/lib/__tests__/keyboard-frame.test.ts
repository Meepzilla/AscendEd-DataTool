import { describe, expect, it } from 'vitest';
import { keyboardFrameStyle } from '@/hooks/use-keyboard-frame';

describe('keyboardFrameStyle', () => {
  it('leaves the screen alone while the keyboard is closed', () => {
    expect(keyboardFrameStyle({ offsetTop: 0, height: 820 }, 820, 0.75)).toBeUndefined();
    // A toolbar's worth of difference is not a keyboard.
    expect(keyboardFrameStyle({ offsetTop: 0, height: 760 }, 820, 0.75)).toBeUndefined();
  });

  it('pins to the visible area, in the zoomed element\'s own pixels, while the keyboard is open', () => {
    // An iPad in landscape: 820 px tall, the keyboard leaves 420 px, and iPadOS has slid the page up 300 px.
    expect(keyboardFrameStyle({ offsetTop: 300, height: 420 }, 820, 0.75)).toEqual({
      position: 'fixed', left: 0, right: 0, top: 400, height: 560, zIndex: 50,
    });
  });

  it('follows the page however far it slides', () => {
    const style = keyboardFrameStyle({ offsetTop: 0, height: 420 }, 820, 1);
    expect(style?.top).toBe(0);
    expect(style?.height).toBe(420);
  });

  it('ignores a scale it cannot use', () => {
    expect(keyboardFrameStyle({ offsetTop: 0, height: 420 }, 820, 0)).toBeUndefined();
    expect(keyboardFrameStyle({ offsetTop: 0, height: 420 }, 820, Number.NaN)).toBeUndefined();
  });
});
