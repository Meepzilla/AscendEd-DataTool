import { describe, expect, it } from 'vitest';
import {
  CARD_TO_SAVE_BAR,
  MIN_STUDENT_CARD_HEIGHT,
  studentCardHeight,
  studentCardTop,
  type StudentCardHeightMeasurements,
} from '../student-card-height';

// A phone-sized screen: the cards region starts 200 CSS px below the body's top, the save bar is
// 64 tall, and there is no bottom menu bar.
const base: StudentCardHeightMeasurements = {
  viewportHeight: 800,
  regionTop: 200,
  bodyTop: 0,
  ratio: 1,
  saveBarHeight: 64,
  menuBarHeight: 0,
};

describe('studentCardHeight', () => {
  it('does not change when the scroll area content is scrolled', () => {
    // Scrolling inside the cards viewport moves a card's rect up by the scroll amount, but the
    // region (outside the scroll area) and the body do not move, so the measurements the height is
    // computed from are identical however far the user has scrolled. The old card-based
    // measurement took the scrolled card top (200 - scrollTop) and grew the card by that amount
    // on every re-measure.
    const unscrolled = studentCardHeight(base);
    for (const scrollTop of [50, 200, 1000]) {
      const scrolledMeasurements = { ...base }; // regionTop/bodyTop unchanged by internal scrolling
      expect(studentCardHeight(scrolledMeasurements)).toBe(unscrolled);
      // The card-based top the old code used would have shrunk by scrollTop; the region-based
      // top never does.
      expect(studentCardTop(base)).toBe(200 + 16);
      expect(studentCardTop(base)).not.toBe(200 - scrollTop + 16);
    }
    expect(unscrolled).toBe(800 - 216 - CARD_TO_SAVE_BAR - 64);
  });

  it('never exceeds the viewport height minus the fixed space below the card', () => {
    const bound = base.viewportHeight - CARD_TO_SAVE_BAR - base.saveBarHeight - base.menuBarHeight;
    for (const regionTop of [-500, 0, 100, 200, 400]) {
      expect(studentCardHeight({ ...base, regionTop })).toBeLessThanOrEqual(bound);
    }
    // A negative region top (a measurement gone wrong) clamps to the bound instead of growing
    // past the screen.
    expect(studentCardHeight({ ...base, regionTop: -500 })).toBe(bound);
  });

  it('keeps the minimum height when the space left is small', () => {
    expect(studentCardHeight({ ...base, viewportHeight: 500 })).toBe(MIN_STUDENT_CARD_HEIGHT);
  });

  it('converts zoomed rects to CSS pixels before adding the list padding', () => {
    // At a ratio of 2 rect units per CSS pixel, a region 400 rect units down starts at 200 CSS px.
    expect(studentCardTop({ regionTop: 400, bodyTop: 0, ratio: 2 })).toBe(216);
    expect(studentCardTop({ regionTop: 440, bodyTop: 40, ratio: 2 })).toBe(216);
  });
});
