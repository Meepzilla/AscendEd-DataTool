// Display size: zooms the whole app out on devices where it feels too large (mainly iPad, where a
// Home Screen app can't be pinch-zoomed below 100%). It works like pinch-zoom by setting the
// viewport's scale, so everything shrinks together, including layouts sized in pixels.

export const DISPLAY_SCALE_KEY = 'ascended_display_scale';
export const DISPLAY_SCALE_OPTIONS = [1, 0.9, 0.8, 0.7] as const;
export const TABLET_DEFAULT_SCALE = 0.8;

/**
 * Applies the display scale to the viewport meta tag(s): `scale` when given, otherwise the stored
 * setting or the device default. Tablets (touch screens at least 600px on their short side) default
 * to 0.8 (TABLET_DEFAULT_SCALE). `maximum-scale` stops iPad Safari from zooming in when a text box
 * is focused; iOS still allows pinch-zoom regardless.
 *
 * The layout width is given explicitly (screen width / scale): iPad Safari keeps `width=device-width`
 * as the layout width even when zoomed out, which left the app filling only part of the screen. The
 * width is recalculated when the device rotates.
 *
 * Next.js adds its own default viewport tag after the page loads, so this updates every viewport tag
 * and watches <head> to re-apply when one is added or reset. Kept self-contained so it can also run
 * as an inline script before the page first paints.
 */
export function applyDisplayScale(scale?: number) {
  try {
    const state = window as unknown as { __displayScale?: number; __displayScaleObserver?: MutationObserver };
    if (scale !== undefined) state.__displayScale = scale;
    if (state.__displayScale === undefined) {
      const stored = Number(window.localStorage.getItem('ascended_display_scale'));
      const isTablet = window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) >= 600;
      state.__displayScale = stored > 0 ? stored : isTablet ? 0.8 : 1;
    }
    const value = state.__displayScale;
    let content = 'width=device-width, initial-scale=1';
    if (value !== 1) {
      const landscape = window.matchMedia('(orientation: landscape)').matches;
      const deviceWidth = landscape ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
      // No maximum-scale: pinch-zoom stays available (Android honors it and would block zooming in).
      content = `width=${Math.round(deviceWidth / value)}, initial-scale=${value}`;
    }

    const metas = document.querySelectorAll('meta[name="viewport"]');
    if (metas.length === 0) {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'viewport');
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
    }
    metas.forEach(meta => {
      if (meta.getAttribute('content') !== content) meta.setAttribute('content', content);
    });

    if (!state.__displayScaleObserver) {
      state.__displayScaleObserver = new MutationObserver(() => applyDisplayScale());
      state.__displayScaleObserver.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['content'] });
      window.matchMedia('(orientation: landscape)').addEventListener('change', () => applyDisplayScale());
    }
  } catch {
    // Keep the default viewport.
  }
}

/** Inline script for the root layout, so the scale is set before the first paint. */
export const DISPLAY_SCALE_SCRIPT = `(${applyDisplayScale.toString()})()`;

export function setDisplayScale(scale: number) {
  try {
    window.localStorage.setItem(DISPLAY_SCALE_KEY, String(scale));
  } catch {
    // Not saved; still applied for this visit.
  }
  applyDisplayScale(scale);
}

/** The scale currently applied (the stored setting or the device default). */
export function getCurrentDisplayScale(): number {
  return (window as unknown as { __displayScale?: number }).__displayScale ?? 1;
}
