'use client';

import { useEffect } from 'react';

// Hides the "Powered by Netlify" badge the host adds to the live site, which covers the Save buttons
// in the bottom corner. The badge isn't part of the app, so it is found by what it looks like: an element
// the host adds to the top level of the page whose tag, id, class, link or text mentions Netlify, or that
// floats above everything with a huge z-index.

const NETLIFY = /netlify/i;
const BADGE_TEXT = /powered by netlify/i;

// The app's own floating layers (dialogs, menus, toasts) stay well below this; injected badges use the
// largest z-index there is, often inside a closed shadow root where their text can't be read.
const INJECTED_Z_INDEX = 100000;

function isHostBadge(el: Element): boolean {
  const attrs = [el.tagName, el.id, String(el.getAttribute('class') ?? ''), el.getAttribute('src') ?? '', el.getAttribute('href') ?? ''].join(' ');
  if (NETLIFY.test(attrs)) return true;
  const text = el.shadowRoot?.textContent ?? el.textContent ?? '';
  if (text.length < 200 && BADGE_TEXT.test(text)) return true;
  const style = getComputedStyle(el);
  return (style.position === 'fixed' || style.position === 'absolute') && Number(style.zIndex) >= INJECTED_Z_INDEX;
}

function hide(el: Element) {
  (el as HTMLElement).style?.setProperty('display', 'none', 'important');
}

export default function HostBadgeHider() {
  useEffect(() => {
    // The badge is added at the top level of the page; the app's own content lives inside its root elements.
    const check = (el: Element) => {
      if (isHostBadge(el)) hide(el);
    };
    const scan = () => {
      Array.from(document.body.children).forEach(check);
      Array.from(document.documentElement.children).forEach(el => el !== document.body && el !== document.head && check(el));
    };
    scan();
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => node instanceof Element && check(node));
      }
    });
    observer.observe(document.body, { childList: true });
    observer.observe(document.documentElement, { childList: true });
    // In case the badge fills in its content (or shadow root) after being added: rescan for the first
    // half minute (the page has only a few top-level elements, so this is cheap).
    const interval = window.setInterval(scan, 1000);
    const stop = window.setTimeout(() => window.clearInterval(interval), 30000);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.clearTimeout(stop);
    };
  }, []);
  return null;
}
