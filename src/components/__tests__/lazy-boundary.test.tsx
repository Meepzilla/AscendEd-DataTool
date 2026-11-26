// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { LazyBoundary, retryableLazy } from '@/components/ui/lazy-boundary';

// Coverage for review finding A2: a lazy modal/input that fails to load must fail inside its own
// slot (with a working retry), not propagate to the route error boundary and replace the page.

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  vi.restoreAllMocks();
});

function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}

describe('LazyBoundary', () => {
  it('shows its own alert with a retry instead of throwing to the page', () => {
    // React logs caught render errors to the console; keep the test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => {
      throw new Error('chunk failed');
    };
    const el = render(
      <div>
        <p>page content</p>
        <LazyBoundary label="This dialog">
          <Boom />
        </LazyBoundary>
      </div>,
    );
    expect(el.textContent).toContain('page content');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('This dialog could not load');
    expect(el.querySelector('button')?.textContent).toContain('Try again');
  });

  it('retry re-renders the children once they can load', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let failing = true;
    const MaybeBoom = () => {
      if (failing) throw new Error('chunk failed');
      return <p>dialog body</p>;
    };
    const el = render(
      <LazyBoundary label="This dialog">
        <MaybeBoom />
      </LazyBoundary>,
    );
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    failing = false;
    const button = [...el.querySelectorAll('button')].find(b => b.textContent?.includes('Try again'));
    act(() => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.textContent).toContain('dialog body');
  });

  it('retryableLazy issues a fresh import after a failure, so a retry can succeed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let attempts = 0;
    const Flaky = retryableLazy(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('chunk failed');
      return { default: () => <p>loaded modal</p> };
    });
    const el = render(
      <LazyBoundary label="This dialog">
        <React.Suspense fallback={null}>
          <Flaky />
        </React.Suspense>
      </LazyBoundary>,
    );
    // Let the rejected import settle into the boundary.
    await act(async () => {});
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    const button = [...el.querySelectorAll('button')].find(b => b.textContent?.includes('Try again'));
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(attempts).toBe(2);
    expect(el.textContent).toContain('loaded modal');
  });
});
