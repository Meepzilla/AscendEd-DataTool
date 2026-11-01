'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useErrorLog } from './use-error-log';
import * as secureStore from '@/lib/secure-store';
import { readList, storageKeys } from '@/lib/data-store';

// Reading and saving the student data lists for useStudentData: the user's storage keys, a read that remembers
// lists that couldn't be read, and a save that reports failures (storage full, or a list that couldn't be read and
// so mustn't be written over) instead of throwing. Damaged lists are only written over by a restore (see unmark).

export function useDataStorage(uid: string | undefined) {
  const { toast } = useToast();
  const { addErrorLog } = useErrorLog();
  const keys = useMemo(() => storageKeys(uid), [uid]);
  // Keys whose stored data couldn't be read: they are never written over, so the data can still be recovered.
  const unreadableKeys = useRef<Set<string>>(new Set());

  /** Stores a list; false (with an error shown) when it couldn't be. */
  const save = useCallback((key: string | null, data: unknown): boolean => {
    if (typeof window === 'undefined' || !key) return false;
    if (unreadableKeys.current.has(key)) {
      toast({ title: "Couldn't save", description: "This device's saved data couldn't be read, so it wasn't overwritten. Restore a backup in Settings.", variant: 'destructive' });
      return false;
    }
    try {
      secureStore.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`Error writing localStorage key "${key}":`, error);
      addErrorLog({ message: `Saving failed: ${error instanceof Error ? error.message : String(error)}`, source: 'storage', type: 'error' });
      toast({
        title: "Couldn't save",
        description: "This device's storage is full or unavailable, so the change was not saved. Back up your data in Settings, then delete old sessions to make room.",
        variant: 'destructive',
      });
      return false;
    }
  }, [toast, addErrorLog]);

  // With passcode protection, data is encrypted into storage in the background; a write that fails there
  // is reported the same way.
  useEffect(() => {
    secureStore.setWriteErrorHandler(error => {
      addErrorLog({ message: `Saving (encrypted) failed: ${error instanceof Error ? error.message : String(error)}`, source: 'storage', type: 'error' });
      toast({ title: "Couldn't save", description: "This device's storage is full or unavailable, so the latest change was not saved. Back up your data in Settings.", variant: 'destructive' });
    });
    return () => secureStore.setWriteErrorHandler(null);
  }, [toast, addErrorLog]);

  /** A stored list; [] when it can't be read, which is remembered (the list is then never written over). */
  const read = useCallback(<T,>(key: string | null): T[] => {
    const value = readList<T>(key);
    if (value !== undefined) return value;
    if (key) unreadableKeys.current.add(key);
    return [];
  }, []);
  /** Forgets which lists couldn't be read (before reading them all again). */
  const resetUnreadable = useCallback(() => unreadableKeys.current.clear(), []);
  const isUnreadable = useCallback((key: string | null) => !!key && unreadableKeys.current.has(key), []);
  /** A restore may replace damaged lists: unmark them first, and mark them again if it is rolled back. */
  const unmark = useCallback((keys: string[]) => keys.forEach(k => unreadableKeys.current.delete(k)), []);
  const mark = useCallback((keys: string[]) => keys.forEach(k => unreadableKeys.current.add(k)), []);

  return { keys, save, read, resetUnreadable, isUnreadable, unmark, mark };
}
