'use client';

import { useEffect, useState, type CSSProperties, type RefObject } from 'react';

// Keeps a full-screen form (the lock screen, passcode setup) inside the part of the screen the on-screen keyboard
// leaves visible. With the keyboard open, iPadOS slides the page up to show the field being typed in; with the
// app's display size (the zoom on <body>) it can slide too far, and each key typed slid the lock screen up behind
// the status bar. While the keyboard is open the form is pinned to the visible area instead, so wherever the page
// ends up, the form stays on screen (and scrolls inside itself if it doesn't fit).

/** The keyboard counts as open when it takes more than this much of the screen's height. */
const KEYBOARD_MIN_HEIGHT = 120;

export interface VisibleArea {
  /** The visible area's top and height, in screen pixels (window.visualViewport.offsetTop and .height). */
  offsetTop: number;
  height: number;
}

/**
 * The style that pins an element to the visible area while the keyboard is open, or undefined when it is closed.
 * `scale` is screen pixels per CSS pixel inside the element (below 1 when <body> is zoomed out), since the
 * element's own lengths are drawn at that scale.
 */
export function keyboardFrameStyle(visible: VisibleArea, screenHeight: number, scale: number): CSSProperties | undefined {
  if (!(screenHeight - visible.height > KEYBOARD_MIN_HEIGHT) || !(scale > 0)) return undefined;
  return {
    position: 'fixed',
    left: 0,
    right: 0,
    top: visible.offsetTop / scale,
    height: visible.height / scale,
    zIndex: 50,
  };
}

/** The style for `ref`'s element while the keyboard is open (see keyboardFrameStyle); undefined otherwise. */
export function useKeyboardFrame(ref: RefObject<HTMLElement | null>): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = ref.current;
        // Screen pixels per CSS pixel inside the element: below 1 when <body> is zoomed out.
        const scale = el && el.offsetHeight > 0 ? el.getBoundingClientRect().height / el.offsetHeight : 1;
        const next = keyboardFrameStyle({ offsetTop: viewport.offsetTop, height: viewport.height }, window.innerHeight, scale);
        setStyle(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      });
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [ref]);
  return style;
}
