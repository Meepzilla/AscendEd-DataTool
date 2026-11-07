import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  describeErrorEvent,
  describeUnhandledRejection,
  installGlobalErrorHandlers,
  type GlobalErrorLog,
} from '../global-error-handler';

// global-error-handler.ts: window errors and unhandled rejections are logged to the in-memory
// error log instead of vanishing. The handlers install once per target (React StrictMode
// double-mounting must not double-log), and the cleanup removes them.
function fakeTarget() {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  return {
    listeners,
    addEventListener(type: string, listener: (event: unknown) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: (event: unknown) => void) {
      listeners.get(type)?.delete(listener);
    },
    emit(type: string, event: unknown) {
      listeners.get(type)?.forEach(listener => listener(event));
    },
  };
}

let target: ReturnType<typeof fakeTarget>;
let logs: GlobalErrorLog[];

beforeEach(() => {
  target = fakeTarget();
  logs = [];
});

describe('describeErrorEvent', () => {
  it('describes a runtime error with its file and line', () => {
    expect(describeErrorEvent({ message: 'boom', filename: 'app.js', lineno: 12, colno: 3, target: {} })).toEqual({
      message: 'boom',
      source: 'window.onerror',
      details: 'app.js, line 12, column 3',
      type: 'error',
    });
  });

  it('describes a failed resource by its tag and source', () => {
    expect(describeErrorEvent({ target: { tagName: 'SCRIPT', src: '/worker.js' } })).toMatchObject({
      message: 'Failed to load a script (/worker.js).',
      source: 'window.onerror',
    });
  });

  it('skips a cross-origin script error with no detail', () => {
    expect(describeErrorEvent({ message: 'Script error.', target: {} })).toBe(null);
  });

  it('falls back to the error object when the message is empty', () => {
    expect(describeErrorEvent({ message: '', error: new Error('from the error'), target: {} })).toMatchObject({
      message: 'from the error',
    });
  });
});

describe('describeUnhandledRejection', () => {
  it('describes an Error reason and a plain reason', () => {
    expect(describeUnhandledRejection(new Error('rejected'))).toMatchObject({ message: 'rejected', source: 'unhandledrejection' });
    expect(describeUnhandledRejection('string reason')).toMatchObject({ message: 'string reason' });
  });

  it('skips an empty reason', () => {
    expect(describeUnhandledRejection(undefined)).toBe(null);
  });
});

describe('installGlobalErrorHandlers', () => {
  it('logs runtime errors and unhandled rejections once, and stops after cleanup', () => {
    const log = vi.fn((entry: GlobalErrorLog) => { logs.push(entry); });
    const cleanup = installGlobalErrorHandlers(target, log);
    target.emit('error', { message: 'boom', filename: 'app.js', target: {} });
    target.emit('unhandledrejection', { reason: new Error('rejected') });
    expect(logs).toHaveLength(2);
    expect(logs[0].source).toBe('window.onerror');
    expect(logs[1].source).toBe('unhandledrejection');
    cleanup();
    target.emit('error', { message: 'again', target: {} });
    expect(logs).toHaveLength(2);
  });

  it('does not double-register on the same target', () => {
    const log = vi.fn();
    const cleanup1 = installGlobalErrorHandlers(target, log);
    const cleanup2 = installGlobalErrorHandlers(target, log);
    target.emit('error', { message: 'boom', target: {} });
    expect(log).toHaveBeenCalledTimes(1);
    // The second install was a no-op, so its cleanup must not remove the first install's listeners.
    cleanup2();
    target.emit('error', { message: 'boom', target: {} });
    expect(log).toHaveBeenCalledTimes(2);
    cleanup1();
    target.emit('error', { message: 'boom', target: {} });
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('a throwing logger never breaks the handler', () => {
    const cleanup = installGlobalErrorHandlers(target, () => { throw new Error('logger broke'); });
    expect(() => target.emit('error', { message: 'boom', target: {} })).not.toThrow();
    cleanup();
  });
});
