'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useErrorLog } from './use-error-log';
import * as secureStore from '@/lib/secure-store';
import { hydrateLists, readList, storageKeys } from '@/lib/data-store';
import { checkSaveFits, formatBytes, serializedBytes } from '@/lib/storage-size';

// Reading and saving the student data lists for useStudentData: the user's storage keys, a read that remembers
// lists that couldn't be read, and a save that reports failures (storage full, or a list that couldn't be read and
// so mustn't be written over) instead of throwing. Damaged lists are only written over by a restore (see unmark).
//
// Durability: save() is async and resolves true only after the write has landed in durable storage and
// read back. It returns false (with an error shown) when the write did not land, and callers only
// update React state on true — so the UI never reports success for data that never reached disk. A size
// check runs before each save: a save that would not fit is refused up front, and a stored total past
// 3 MB warns once until the total drops back below it.

export function useDataStorage(uid: string | undefined) {
  const { toast } = useToast();
  const { addErrorLog } = useErrorLog();
  const keys = useMemo(() => storageKeys(uid), [uid]);
  // Keys whose stored data couldn't be read: they are never written over, so the data can still be recovered.
  const unreadableKeys = useRef<Set<string>>(new Set());
  // Whether the over-3-MB warning has been shown for the current stretch above 3 MB.
  const warnedOver3MB = useRef(false);

  /** Fills the lists' in-memory cache from durable storage (migrating localStorage blobs first). */
  const hydrate = useCallback(() => hydrateLists(keys), [keys]);

  /** Bytes the app can count itself, when the browser reports no storage estimate. */
  const fallbackBytes = useCallback(() => {
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) total += (localStorage.getItem(k)?.length ?? 0) + k.length;
      }
    } catch {
      /* storage unavailable */
    }
    return total + secureStore.getPersistedListBytes();
  }, []);

  /** Stores a list; false (with an error shown) when it couldn't be stored. */
  const save = useCallback(async (key: string | null, data: unknown): Promise<boolean> => {
    if (typeof window === 'undefined' || !key) return false;
    if (unreadableKeys.current.has(key)) {
      toast({ title: "Couldn't save", description: "This device's saved data couldn't be read, so it wasn't overwritten. Restore a backup in Settings.", variant: 'destructive' });
      return false;
    }
    // Size check before the save: refuse a write that would not fit, and warn past 3 MB.
    const newBytes = serializedBytes(data);
    try {
      const size = await checkSaveFits(newBytes, secureStore.getCurrentKeyBytes(key), {
        isIndexedDbBacked: secureStore.isListKey(key) && secureStore.getListBackend(key) === 'idb',
        fallbackBytes,
      });
      if (!size.fits) {
        addErrorLog({ message: `Saving failed: storage is full (${formatBytes(size.projectedBytes)} needed).`, source: 'storage', type: 'error' });
        toast({
          title: "Couldn't save",
          description: "This device's storage is full, so the change was not saved. Back up your data in Settings, then delete old sessions to make room.",
          variant: 'destructive',
        });
        return false;
      }
      if (size.over3MB && !warnedOver3MB.current) {
        warnedOver3MB.current = true;
        toast({
          title: 'Storage is getting full',
          description: `Your data now uses ${formatBytes(size.projectedBytes)}. Back up your data in Settings so it isn't lost if this device is reset.`,
        });
      } else if (!size.over3MB) {
        warnedOver3MB.current = false;
      }
    } catch {
      // The size check itself failed: carry on and let the write report the real result.
    }
    try {
      await secureStore.setItemAsync(key, JSON.stringify(data));
      // Verify the write read back from durable storage before reporting success.
      if (!(await secureStore.verifyStoredList(key, data))) {
        throw new Error('Save verification failed: the stored data does not match.');
      }
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
  }, [toast, addErrorLog, fallbackBytes]);

  // With passcode protection, data is encrypted into storage in the background; a write that fails there
  // is reported the same way. (Committed saves await the write themselves; this covers the fire-and-
  // forget Data Entry draft.)
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

  return { keys, save, read, resetUnreadable, isUnreadable, unmark, mark, hydrate };
}
