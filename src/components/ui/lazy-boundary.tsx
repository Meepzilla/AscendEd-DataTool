'use client';

import React, { Component, lazy, type ComponentType, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Error boundary for lazily loaded modals and inputs (review finding A2). Without it, a lazy chunk
// that fails to load (offline, or pruned by a newer service worker) throws to the route-level error
// boundary, which replaces the whole page — losing scroll, focus and in-progress work — just because
// a dialog could not open. This boundary keeps the failure inside the modal's own slot: the page
// stays put and the user gets a Try again button (and a Close button when onDismiss is supplied).
//
// React.lazy caches a rejected import on the lazy component itself, so resetting a boundary alone
// re-throws the same rejection and a retry could never succeed. retryableLazy therefore tracks
// whether its own import failed and recreates its lazy component on the next attempt ONLY when it
// failed. Already-loaded components keep the same lazy component identity so retrying a broken
// chunk never unmounts or wipes state in sibling or parent modals/inputs.

let lazyAttempt = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors React.lazy's own typing
export function retryableLazy<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): T {
  let cached: { attempt: number; component: React.LazyExoticComponent<T> } | null = null;
  let failed = false;
  const load = () => factory().then(
    mod => {
      failed = false;
      return mod;
    },
    err => {
      failed = true;
      throw err;
    },
  );
  function RetryableLazyComponent(props: React.ComponentProps<T>) {
    if (!cached || (failed && cached.attempt !== lazyAttempt)) {
      failed = false;
      cached = { attempt: lazyAttempt, component: lazy(load) };
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
  /** Optional dismiss handler (e.g. closing a modal that failed to load so the alert can be cleared offline). */
  onDismiss?: () => void;
  /** Render the fallback as a floating overlay (used for modals mounted inside a fixed header). */
  floating?: boolean;
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

  private dismiss = () => {
    this.setState({ error: null });
    this.props.onDismiss?.();
  };

  render() {
    if (this.state.error) {
      const containerClass = this.props.floating
        ? 'fixed top-[72px] right-4 z-50 max-w-md flex items-center gap-3 rounded-md border border-destructive/50 bg-card p-3 text-sm shadow-lg'
        : 'flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm';
      return (
        <div role="alert" className={containerClass}>
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <p className="flex-1">
            {this.props.label ?? 'This part of the page'} could not load. The rest of this page is
            unchanged. Check your connection and try again.
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={this.retry}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden /> Try again
            </Button>
            {this.props.onDismiss && (
              <Button size="sm" variant="ghost" onClick={this.dismiss} aria-label="Close">
                <X className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
