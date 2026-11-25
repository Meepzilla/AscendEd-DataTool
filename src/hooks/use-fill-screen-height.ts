'use client';

import { useEffect, useState, type RefObject } from 'react';
import { MENU_POSITION_EVENT } from '@/lib/ui-preferences';

/**
 * The height (in CSS pixels) that lets `listRef`'s element fill the rest of the screen: from where it starts down to
 * the bottom of the scrolling <main>, less what comes after it in the page (`pageRef`'s element: the rest of its card
 * and the page's bottom padding) and less the menu bar when it is at the bottom. The page then ends exactly at the
 * menu bar, as a long page does, instead of stopping halfway down with the bar and the footer under it.
 * Undefined until measured; never below `min`, so a short screen still gets a usable list (the page scrolls then).
 */
export function useFillScreenHeight(
  listRef: RefObject<HTMLElement | null>,
  pageRef: RefObject<HTMLElement | null>,
  min = 320,
  /** False while the page shows something else (a loading skeleton): measuring starts once the list is there. */
  ready = true,
): number | undefined {
  const [height, setHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const list = listRef.current;
    const page = pageRef.current;
    const main = list?.closest('main') as HTMLElement | null;
    if (!list || !page || !main) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (list.offsetHeight === 0) return;
        // Rect units per CSS pixel: the app zooms <body> (the display size setting), so the two differ. The
        // factor is read from the --body-zoom variable, never measured off the list itself: a measured ratio
        // wobbles as the list's height changes (offsetHeight is rounded to whole pixels, the rect is not), the
        // computed height then alternated between two values, and the bottom of the page flickered.
        const ratio = parseFloat(getComputedStyle(document.body).getPropertyValue('--body-zoom')) || 1;
        const mainRect = main.getBoundingClientRect();
        if (mainRect.height === 0) return;
        const listRect = list.getBoundingClientRect();
        const pageRect = page.getBoundingClientRect();
        const padding = parseFloat(getComputedStyle(page.parentElement ?? page).paddingBottom) || 0;
        // Where the list starts within the scrolling content, and what follows it on the page.
        const top = listRect.top - mainRect.top + main.scrollTop * ratio;
        const below = pageRect.bottom - listRect.bottom + padding * ratio;
        const menuBar = document.documentElement.classList.contains('menu-bottom')
          ? document.querySelector<HTMLElement>('.app-menubar')?.getBoundingClientRect().height ?? 0
          : 0;
        const available = (mainRect.height - menuBar - top - below) / ratio;
        if (!Number.isFinite(available)) return;
        const next = Math.max(min, Math.floor(available));
        // A pixel of measurement noise must never move the list: applying a new height resizes the page, which
        // re-runs this measurement through the observer below.
        setHeight(prev => (prev !== undefined && Math.abs(prev - next) <= 1 ? prev : next));
      });
    };
    update();
    // The screen (rotation, display size), the page above the list (filters wrapping, a storage warning) and the
    // menu bar moving all change the space. No input depends on the list's own height, and the setter ignores a
    // pixel of noise, so applying the result can't retrigger a different one.
    const observer = new ResizeObserver(update);
    observer.observe(main);
    observer.observe(page);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.addEventListener(MENU_POSITION_EVENT, update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.removeEventListener(MENU_POSITION_EVENT, update);
    };
  }, [listRef, pageRef, min, ready]);
  return height;
}
