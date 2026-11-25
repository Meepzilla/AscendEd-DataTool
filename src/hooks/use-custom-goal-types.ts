'use client';

import { useCallback, useEffect, useState } from 'react';
import { generateUUID } from '@/lib/helpers';
import * as secureStore from '@/lib/secure-store';
import type { CustomGoalType } from '@/lib/types';
import { cloneCustomGoalType } from '@/lib/goal-types/custom';
import {
  CUSTOM_GOAL_TYPES_EVENT,
  customGoalTypesKey,
  getCustomGoalTypes,
  isValidStoredCustomGoalType,
  saveCustomGoalTypes,
} from '@/lib/custom-goal-types';

/** React hook for reading and updating the user's custom goal types across the app. */
export function useCustomGoalTypes(userId: string | undefined) {
  const [customTypes, setCustomTypes] = useState<CustomGoalType[]>([]);

  useEffect(() => {
    const load = () => setCustomTypes(getCustomGoalTypes(userId).sort((a, b) => a.name.localeCompare(b.name)));
    load();
    window.addEventListener(CUSTOM_GOAL_TYPES_EVENT, load);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== customGoalTypesKey(userId) && event.key !== null) return;
      void secureStore.refreshFromStorage(customGoalTypesKey(userId)).then(load);
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CUSTOM_GOAL_TYPES_EVENT, load);
      window.removeEventListener('storage', onStorage);
    };
  }, [userId]);

  const saveCustomType = useCallback((draft: Omit<CustomGoalType, 'id' | 'version' | 'createdAt'> & { id?: string; version?: number; createdAt?: string }) => {
    const all = getCustomGoalTypes(userId);
    const existing = draft.id ? all.find(t => t.id === draft.id) : undefined;
    const now = new Date().toISOString();
    const candidate: CustomGoalType = {
      ...draft,
      id: existing?.id ?? draft.id ?? generateUUID(),
      version: existing ? (existing.version || 1) + 1 : (draft.version ?? 1),
      name: draft.name.trim(),
      description: draft.description?.trim() || undefined,
      createdAt: existing?.createdAt ?? draft.createdAt ?? now,
      updatedAt: now,
    };
    if (!isValidStoredCustomGoalType(candidate)) {
      throw new Error('Custom goal type is not valid.');
    }
    const next = existing
      ? all.map(t => (t.id === existing.id ? candidate : t))
      : [...all, candidate];
    saveCustomGoalTypes(userId, next);
    return candidate;
  }, [userId]);

  const duplicateCustomType = useCallback((id: string) => {
    const all = getCustomGoalTypes(userId);
    const source = all.find(t => t.id === id);
    if (!source) return null;
    const now = new Date().toISOString();
    const copy: CustomGoalType = {
      ...cloneCustomGoalType(source),
      id: generateUUID(),
      version: 1,
      name: `${source.name} (Copy)`,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    saveCustomGoalTypes(userId, [...all, copy]);
    return copy;
  }, [userId]);

  const setCustomTypeArchived = useCallback((id: string, isArchived: boolean) => {
    const all = getCustomGoalTypes(userId);
    saveCustomGoalTypes(userId, all.map(t => (t.id === id ? { ...t, isArchived, updatedAt: new Date().toISOString() } : t)));
  }, [userId]);

  const deleteCustomType = useCallback((id: string) => {
    const all = getCustomGoalTypes(userId);
    saveCustomGoalTypes(userId, all.filter(t => t.id !== id));
  }, [userId]);

  const importCustomTypes = useCallback((incoming: CustomGoalType[]) => {
    const all = getCustomGoalTypes(userId);
    const byId = new Map(all.map(t => [t.id, t]));
    let added = 0;
    let updated = 0;
    for (const item of incoming) {
      const prev = byId.get(item.id);
      if (!prev) {
        byId.set(item.id, item);
        added++;
      } else if ((item.version || 1) >= (prev.version || 1)) {
        byId.set(item.id, item);
        updated++;
      }
    }
    saveCustomGoalTypes(userId, [...byId.values()]);
    return { added, updated };
  }, [userId]);

  return {
    customTypes,
    saveCustomType,
    duplicateCustomType,
    setCustomTypeArchived,
    deleteCustomType,
    importCustomTypes,
  };
}
