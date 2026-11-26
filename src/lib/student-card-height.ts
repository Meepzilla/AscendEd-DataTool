// The Data Entry student-card height, as pure math so it can be tested without a browser.
//
// The card's top is derived from the cards region's top, never from a card inside the scroll area:
// the region wraps the ScrollArea, so its position does not move when the viewport's content
// scrolls. Measuring a card instead made the height grow by the scroll amount on every
// re-measure — as the card got taller the content got taller, the user could scroll further,
// and the next measurement grew it again (seen on Android while scrolling Data Entry).

export const MIN_STUDENT_CARD_HEIGHT = 420;
export const CARD_TO_SAVE_BAR = 32; // the cards list's bottom padding plus room for its horizontal scrollbar
export const CARDS_LIST_TOP_PADDING = 16; // the cards list's top padding (p-4), in CSS pixels

export interface StudentCardHeightMeasurements {
  /** Height of the full-height viewport probe, in CSS pixels. */
  viewportHeight: number;
  /** Top of the cards region's rect, in the same (possibly zoomed) rect units as bodyTop. */
  regionTop: number;
  /** Top of the document body's rect, in the same rect units as regionTop. */
  bodyTop: number;
  /** Rect units per CSS pixel, from an element whose size isn't animating. */
  ratio: number;
  saveBarHeight: number;
  menuBarHeight: number;
}

/** Where the first card's top sits with the page at the top, in CSS pixels below the body's top. */
export function studentCardTop({ regionTop, bodyTop, ratio }: Pick<StudentCardHeightMeasurements, 'regionTop' | 'bodyTop' | 'ratio'>): number {
  // Nothing sits between the region's top and the cards list's top padding: the ScrollArea root
  // and viewport add no border or padding, so the first card starts one list padding below the
  // region's top, however far the viewport's content is scrolled.
  return (regionTop - bodyTop) / ratio + CARDS_LIST_TOP_PADDING;
}

export function studentCardHeight(measurements: StudentCardHeightMeasurements): number {
  const { viewportHeight, saveBarHeight, menuBarHeight } = measurements;
  const available = viewportHeight - studentCardTop(measurements) - CARD_TO_SAVE_BAR - saveBarHeight - menuBarHeight;
  // Bounded by the screen: even if a top measurement came back negative, the card can never be
  // taller than the viewport minus the fixed space below it.
  const screenBound = viewportHeight - CARD_TO_SAVE_BAR - saveBarHeight - menuBarHeight;
  return Math.max(MIN_STUDENT_CARD_HEIGHT, Math.min(Math.floor(available), Math.floor(screenBound)));
}
