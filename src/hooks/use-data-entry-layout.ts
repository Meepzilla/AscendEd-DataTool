'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Data Entry's layout: student cards sized to the screen, the save bar's height shared with notifications, and
// the arrows that scroll the cards sideways. Attach the returned refs to the page's elements.

// Student cards fill the screen height below the header card, down to the save bar.
const MIN_STUDENT_CARD_HEIGHT = 420;
const CARD_TO_SAVE_BAR = 32; // the cards list's bottom padding plus room for its horizontal scrollbar

export function useDataEntryLayout(selectedCount: number) {
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRegionRef = useRef<HTMLDivElement>(null);
  const saveBarRef = useRef<HTMLDivElement>(null);
  const viewportProbeRef = useRef<HTMLDivElement>(null);
  const hasSelectedStudents = selectedCount > 0;

  // The arrows in the middle of the save bar scroll the student cards sideways, one card at a time
  // (the next card that is partly or fully out of view is lined up with the left edge).
  const [cardScroll, setCardScroll] = useState({ left: false, right: false });
  const cardsViewport = () => cardsRegionRef.current?.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]') ?? null;
  const updateCardScroll = useCallback(() => {
    const vp = cardsViewport();
    if (!vp) return;
    const left = vp.scrollLeft > 1;
    const right = vp.scrollLeft + vp.clientWidth < vp.scrollWidth - 1;
    setCardScroll(prev => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);
  useEffect(() => {
    const vp = cardsViewport();
    if (!vp) return;
    updateCardScroll();
    vp.addEventListener('scroll', updateCardScroll, { passive: true });
    const observer = new ResizeObserver(updateCardScroll);
    observer.observe(vp);
    if (vp.firstElementChild) observer.observe(vp.firstElementChild);
    return () => {
      vp.removeEventListener('scroll', updateCardScroll);
      observer.disconnect();
    };
  }, [updateCardScroll, selectedCount]);
  const scrollCards = useCallback((direction: -1 | 1) => {
    const vp = cardsViewport();
    if (!vp) return;
    const view = vp.getBoundingClientRect();
    // Rects can be in screen pixels while scrolling is in CSS pixels (the zoomed body), so convert.
    const toCss = vp.clientWidth / (view.width || 1) || 1;
    const lefts = [...vp.querySelectorAll<HTMLElement>('[id^="student-card-slot-"]')].map(card => card.getBoundingClientRect().left - view.left);
    const padding = 16 / toCss; // the row's left padding, kept in view
    const target = direction === 1
      ? lefts.find(x => x > padding + 2)
      : [...lefts].reverse().find(x => x < padding - 2);
    const delta = target === undefined ? direction * view.width * 0.8 : target - padding;
    vp.scrollBy({ left: delta * toCss, behavior: 'smooth' });
  }, []);

  // Notifications (toasts) sit above the save bar instead of over the Save buttons: the bar's height is shared
  // as --save-bar-height while it is shown.
  useEffect(() => {
    const bar = saveBarRef.current;
    const rootStyle = document.documentElement.style;
    if (!hasSelectedStudents || !bar) return;
    const observer = new ResizeObserver(() => rootStyle.setProperty('--save-bar-height', `${bar.offsetHeight}px`));
    observer.observe(bar);
    return () => { observer.disconnect(); rootStyle.removeProperty('--save-bar-height'); };
  }, [hasSelectedStudents]);

  // Size the student cards to the space left on screen. Collapsing the date and time card frees space, so
  // the cards grow; the header and save bar are observed so any change in their height is picked up.
  // The app sets CSS zoom on <body>, and browsers differ in how element rects account for it (iPad Safari
  // differs from Chrome), so every measurement is a rect of an element in the same zoomed context,
  // converted to CSS pixels with the save bar's rect-to-CSS-pixel ratio.
  useEffect(() => {
    const update = () => {
      const root = rootRef.current;
      const region = cardsRegionRef.current;
      const probe = viewportProbeRef.current;
      if (!root || !region || !probe) return;
      const card = root.querySelector<HTMLElement>('[id^="student-card-slot-"]');
      const saveBar = saveBarRef.current;
      if (!card || !saveBar || saveBar.offsetHeight === 0) return;
      // Rect units per CSS pixel, from an element whose size isn't animating (the card animates height changes).
      const saveBarRect = saveBar.getBoundingClientRect();
      const ratio = saveBarRect.height / saveBar.offsetHeight || 1;
      // Where the save bar ends with the page scrolled to the top: the card's top, its height, its padding and
      // the bar itself. (The bar's own position isn't used: it is sticky, which can hide an overflow.)
      const cardTop = (card.getBoundingClientRect().top - document.body.getBoundingClientRect().top) / ratio;
      const screenBottom = probe.getBoundingClientRect().height / ratio;
      // With the menu bar at the bottom (Settings), the save bar sits above it.
      const menuBar = document.documentElement.classList.contains('menu-bottom')
        ? document.querySelector<HTMLElement>('.app-menubar')?.offsetHeight ?? 0
        : 0;
      const available = screenBottom - cardTop - CARD_TO_SAVE_BAR - saveBar.offsetHeight - menuBar;
      root.style.setProperty('--student-card-height', `${Math.max(MIN_STUDENT_CARD_HEIGHT, Math.floor(available))}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    // The region changes size when cards appear, and the full-height probe when the screen size changes
    // (rotation, Safari's toolbars, the display size setting). The result doesn't depend on the card's
    // height, so this can't loop.
    // The menu bar too, when it is at the bottom (its height is taken off the space).
    const menuBar = document.querySelector<HTMLElement>('.app-menubar');
    [headerRef.current, saveBarRef.current, cardsRegionRef.current, viewportProbeRef.current, menuBar].forEach(el => el && observer.observe(el));
    // Cards load after the page, so also update when they are added (at most once a frame).
    let frame = 0;
    const cardsObserver = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    });
    if (cardsRegionRef.current) cardsObserver.observe(cardsRegionRef.current, { childList: true, subtree: true });
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      cardsObserver.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [hasSelectedStudents]);

  return { rootRef, headerRef, cardsRegionRef, saveBarRef, viewportProbeRef, cardScroll, scrollCards };
}
