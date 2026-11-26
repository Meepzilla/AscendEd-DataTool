'use client';

import React, { Component, lazy, type ComponentType, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Error boundary for lazily loaded modals and inputs (review finding A2). Without it, a lazy chunk
// that fails to load (offline, or pruned by a newer service worker) throws to the route-level error
// boundary, which replaces the whole page — losing scroll, focus and in-progress work — just because
// a dialog could not open. This boundary keeps the failure inside the modal's own slot: the page
// stays put and the user gets a Try again button.
//
// React.lazy caches a rejected import on the lazy component itself, so resetting a boundary alone
// re-throws the same rejection and a retry could never succeed. retryableLazy therefore recreates
// its lazy component whenever the shared attempt counter moves, and the boundary's retry moves it:
// the fresh lazy component issues a fresh import(), and the bundler retries the chunk fetch after a
// failure. The counter is shared, so one retry refreshes every retryable lazy component; ones that
// already loaded resolve again from the module cache with no visible effect.

let lazyAttempt = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors React.lazy's own typing
export function retryableLazy<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): T {
  let cached: { attempt: number; component: React.LazyExoticComponent<T> } | null = null;
  function RetryableLazyComponent(props: React.ComponentProps<T>) {
    if (!cached || cached.attempt !== lazyAttempt) {
      cached = { attempt: lazyAttempt, component: lazy(factory) };
    }
    const Loaded = cached.component;
    return <Loaded {...props} />;
  }
  return RetryableLazyComponent as unknown as T;
}

interface LazyBoundaryProps {
  children: ReactNode;
  /** What failed to load, named for the user; defaults to a generic part of the page. */
  label?: string;
}

interface LazyBoundaryState {
  error: Error | null;
}

export class LazyBoundary extends Component<LazyBoundaryProps, LazyBoundaryState> {
  state: LazyBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): LazyBoundaryState {
    return { error };
  }

  private retry = () => {
    lazyAttempt += 1;
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <p className="flex-1">
            {this.props.label ?? 'This part of the page'} could not load. The rest of this page is
            unchanged. Check your connection and try again.
          </p>
          <Button size="sm" variant="outline" onClick={this.retry}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden /> Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
