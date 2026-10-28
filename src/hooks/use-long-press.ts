'use client';

import React, { useCallback, useEffect, useRef } from 'react';

const LONG_PRESS_MS = 500;

/**
 * Handlers that call `onLongPress` when a button is pressed and held (touch or pen), or right-clicked
 * with a mouse. Spread the result onto the button.
 *
 * Android turns a long press into a `contextmenu` event, but iPad Safari never does: it selects the
 * text instead. So touch presses are timed here, and the button's own text selection and callout are
 * turned off with `longPressStyle`.
 */
export function useLongPress<T extends HTMLElement>(onLongPress: (event: React.SyntheticEvent<T>) => void) {
  const timerRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const pointerTypeRef = useRef('mouse');

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback((event: React.PointerEvent<T>) => {
    pointerTypeRef.current = event.pointerType;
    firedRef.current = false;
    cancel();
    if (event.pointerType === 'mouse') return; // mice use right-click
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      firedRef.current = true;
      onLongPress(event);
    }, LONG_PRESS_MS);
  }, [cancel, onLongPress]);

  const onContextMenu = useCallback((event: React.MouseEvent<T>) => {
    event.preventDefault();
    // A touch long press is handled by the timer; Android also sends contextmenu for it.
    if (pointerTypeRef.current === 'mouse') onLongPress(event);
  }, [onLongPress]);

  // The tap that ends a long press shouldn't also count as a click.
  const onClickCapture = useCallback((event: React.MouseEvent<T>) => {
    if (firedRef.current) {
      firedRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  return {
    onPointerDown,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu,
    onClickCapture,
  };
}

/** Stops iPad Safari from selecting the text or showing a callout during a long press. */
export const longPressStyle: React.CSSProperties = {
  WebkitUserSelect: 'none',
  userSelect: 'none',
  WebkitTouchCallout: 'none',
} as React.CSSProperties;
