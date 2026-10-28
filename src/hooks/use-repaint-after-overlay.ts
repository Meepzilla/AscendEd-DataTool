'use client';

import { useEffect } from 'react';

const OVERLAY = '[role="dialog"], [role="alertdialog"]';

/**
 * Redraws the page after a dialog closes. iPad Safari can keep showing a dialog's dimmed backdrop over
 * parts of the page that did not change while it was open (such as the top bar), leaving them hazy until
 * the app is reloaded. Briefly changing the page's opacity makes Safari draw all of it again.
 */
export function useRepaintAfterOverlay() {
  useEffect(() => {
    let overlayOpen = !!document.querySelector(OVERLAY);
    let frame = 0;
    const repaint = () => {
      const body = document.body;
      body.style.opacity = '0.999';
      cancelAnimationFrame(frame);
      // Two frames, so the changed page is drawn before it is put back.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => { body.style.opacity = ''; });
      });
    };
    const observer = new MutationObserver(() => {
      const open = !!document.querySelector(OVERLAY);
      if (overlayOpen && !open) {
        // Again once the dialog's closing animation has finished.
        repaint();
        window.setTimeout(repaint, 400);
      }
      overlayOpen = open;
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
}
