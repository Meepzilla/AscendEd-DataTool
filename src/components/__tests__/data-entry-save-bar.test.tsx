// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// The Data Entry bar (Student and Goal selector, save buttons) collapses to a slim "Show" strip, and the choice
// is remembered on the device.

vi.mock('@/components/forms/touch-controls', () => ({ default: () => <div data-testid="touch-controls">Student / Goal</div> }));
vi.mock('@/components/student-groups/LoadGroupMenu', () => ({ default: () => <button type="button">Load Group</button> }));

import DataEntrySaveBar from '@/components/data-entry/DataEntrySaveBar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const noop = () => {};
const props = {
  barRef: { current: null },
  touchControls: {} as never,
  onLoadGroup: noop, onRemoveAll: noop, isStudentAccessLocked: false,
  cardScroll: { left: false, right: false }, onScrollCards: noop,
  canAddStudent: true, onAddStudent: noop, onReset: noop, onSave: noop, onSaveAll: noop,
  isSaving: false, isSavingAll: false,
};

function render() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<DataEntrySaveBar {...props} />));
}

const controls = () => container!.querySelector('#data-entry-bar-controls')!;
const button = (label: RegExp) => [...container!.querySelectorAll('button')].find(b => label.test(b.getAttribute('aria-label') ?? b.textContent ?? ''));

beforeEach(() => localStorage.clear());
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('Data Entry save bar', () => {
  it('collapses to a Show strip and expands again, remembering the choice', () => {
    render();
    expect(controls().className).toContain('flex');
    expect(button(/^Show Student/)).toBeUndefined();

    act(() => button(/Hide the student and save controls/)!.click());
    expect(controls().className.split(' ')).toContain('hidden');
    expect(button(/^Show Student/)).toBeDefined();
    expect(localStorage.getItem('ascended_data_entry_bar_collapsed')).toBe('1');

    act(() => button(/^Show Student/)!.click());
    expect(controls().className.split(' ')).not.toContain('hidden');
    expect(localStorage.getItem('ascended_data_entry_bar_collapsed')).toBe('0');
  });

  it('opens collapsed when it was left collapsed', () => {
    localStorage.setItem('ascended_data_entry_bar_collapsed', '1');
    render();
    expect(controls().className.split(' ')).toContain('hidden');
    expect(button(/^Show Student/)!.getAttribute('aria-expanded')).toBe('false');
  });
});
