'use client';

import React from 'react';
import { APP_NAME } from '@/lib/appConstants';

// A plain version of the menu bar for screens shown before the app itself (the passcode lock screen and the
// loading screens). iPadOS blurs the top edge of a page unless a solid bar is pinned there, and it keeps that blur
// after the real menu bar appears; with this bar in the same place and color, the top edge is never blurred.
// Same position, padding and height as AppHeader.

export default function TopEdgeBar() {
  return (
    <>
      <div aria-hidden className="h-[65px] w-full shrink-0" />
      <div
        className="fixed inset-x-0 top-0 z-40 border-b bg-card"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) / var(--body-zoom))',
          paddingLeft: 'calc(env(safe-area-inset-left) / var(--body-zoom))',
          paddingRight: 'calc(env(safe-area-inset-right) / var(--body-zoom))',
        }}
      >
        <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-primary" aria-hidden>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.09L6.71 11.8l1.41-1.41L11 13.27l4.88-4.88 1.41 1.41L11 16.09z"/>
          </svg>
          <span className="font-semibold text-foreground">{APP_NAME}</span>
        </div>
      </div>
    </>
  );
}
