'use client';

import { useEffect } from 'react';

// The page is shrunk with CSS zoom on <body> (globals.css). Browsers measure zoomed elements differently:
// Chromium (Chrome, Edge, the Android app's WebView) reports positions in screen pixels, so a menu placed at
// the measured position inside the zoomed body lands at 75% of it (far from its button); Safari reports them
// in the body's own pixels, which works as is. This checks which kind of browser it is and, for the first
// kind, marks <html> so globals.css places menus and popovers in screen pixels (and shrinks their contents
// back to the app's size).

export default function ZoomCompensation() {
  useEffect(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:100px;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const zoom = parseFloat(getComputedStyle(document.body).zoom || '1') || 1;
    const left = probe.getBoundingClientRect().left;
    probe.remove();
    // Positions come back zoomed (e.g. 75 for 100px at 0.75): place floating content in screen pixels.
    document.documentElement.classList.toggle('zoomed-rects', zoom !== 1 && Math.abs(left - 100 * zoom) < 1);
  }, []);
  return null;
}
