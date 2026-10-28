'use client';

import { useEffect, type RefObject } from 'react';

const OVERLAY = '[role="dialog"], [role="alertdialog"]';

/**
 * Redraws an element after a dialog closes. iPad Safari draws the sticky header as its own layer and can
 * keep the picture it had under a dialog's dimmed backdrop after the dialog is gone, leaving the header
 * hazy until the app is reloaded. Briefly changing the layer makes Safari draw it again.
 */
export function useRepaintAfterOverlay(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let overlayOpen = !!document.querySelector(OVERLAY);
    let frame = 0;
    const repaint = () => {
      const el = ref.current;
      if (!el) return;
      el.style.transform = 'translateZ(0)';
      cancelAnimationFrame(frame);
      // Two frames, so the changed layer is drawn before it is put back.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => { el.style.transform = ''; });
      });
    };
    const observer = new MutationObserver(() => {
      const open = !!document.querySelector(OVERLAY);
      if (overlayOpen && !open) {
        // Again after the backdrop's fade-out animation has finished.
        repaint();
        window.setTimeout(repaint, 400);
      }
      overlayOpen = open;
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [ref]);
}
