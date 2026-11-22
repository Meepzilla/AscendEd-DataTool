'use client';

import { useEffect, useState } from 'react';
import { loadCommFunctions, onCommFunctionsChange } from '@/lib/comm-functions';
import { DEFAULT_COMM_FUNCTIONS, type CommFunction } from '@/lib/goal-constants/communication';

/** The communication functions list (Settings → Communication Functions, hidden ones included), kept up to date. */
export function useCommFunctions(): CommFunction[] {
  const [list, setList] = useState<CommFunction[]>(DEFAULT_COMM_FUNCTIONS);
  useEffect(() => {
    setList(loadCommFunctions());
    return onCommFunctionsChange(() => setList(loadCommFunctions()));
  }, []);
  return list;
}
