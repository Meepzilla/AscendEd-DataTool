'use client';

import { useCallback, useEffect, useState } from 'react';
import * as secureStore from '@/lib/secure-store';
import { estimateStorage, type StorageEstimate } from '@/lib/storage-size';

// How much this origin has stored (IndexedDB + localStorage), from the browser estimate when it
// reports one, else from what the app can count itself. Refreshes when refreshKey changes (the
// caller passes something that changes when the data does, such as the record counts).

function fallbackBytes(): number {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) total += (localStorage.getItem(key)?.length ?? 0) + key.length;
    }
  } catch {
    /* storage unavailable */
  }
  return total + secureStore.getPersistedListBytes();
}

export function useStorageSize(refreshKey: unknown) {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);

  const refresh = useCallback(async () => {
    setEstimate(await estimateStorage(fallbackBytes));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  return { estimate, refresh };
}
