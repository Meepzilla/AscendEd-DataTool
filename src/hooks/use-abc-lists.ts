'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_ABC_LISTS, loadAbcLists, onAbcListsChange, type AbcLists } from '@/lib/abc-lists';

/** The ABC data choices (Settings → ABC Data Lists), kept up to date when they're edited. */
export function useAbcLists(): AbcLists {
  const [lists, setLists] = useState<AbcLists>(DEFAULT_ABC_LISTS);
  useEffect(() => {
    setLists(loadAbcLists());
    return onAbcListsChange(() => setLists(loadAbcLists()));
  }, []);
  return lists;
}
