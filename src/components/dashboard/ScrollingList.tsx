'use client';

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

/** Rows a dashboard list shows at once; it scrolls for the rest. */
export const VISIBLE_ROWS = 4;

/**
 * A list as tall as its first VISIBLE_ROWS rows, scrolling for the rest. Rows differ in height (names and
 * figures wrap on narrow screens), so the height is measured from the rows rather than fixed.
 */
export default function ScrollingList({ count, label, children }: { count: number; label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
  // Measured after every render, since a row's text can change (and wrap differently) without the count
  // changing, and again when the list's width changes (rotation). Same value: no re-render.
  const measure = useCallback(() => {
    const list = ref.current;
    if (!list) return;
    const rows = list.children;
    if (rows.length <= VISIBLE_ROWS) return setMaxHeight(undefined);
    setMaxHeight((rows[VISIBLE_ROWS] as HTMLElement).offsetTop - (rows[0] as HTMLElement).offsetTop);
  }, []);
  useLayoutEffect(measure);
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure]);
  const scrolls = count > VISIBLE_ROWS;
  return (
    <ul
      ref={ref}
      className="relative divide-y overflow-y-auto overscroll-contain"
      style={maxHeight ? { maxHeight } : undefined}
      // A list that scrolls can be reached with Tab and scrolled with the arrow keys.
      tabIndex={scrolls ? 0 : undefined}
      aria-label={scrolls ? `${label}, ${count}, scrollable` : undefined}
    >
      {children}
    </ul>
  );
}
