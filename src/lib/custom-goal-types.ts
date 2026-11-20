'use client';

import { useCallback, useEffect, useState } from 'react';
import { generateUUID } from './helpers';
import * as secureStore from './secure-store';
import { CustomGoalTypeSchema, type CustomGoalType, type Goal, type GoalTemplate } from './types';
import { cloneCustomGoalType } from './goal-types/custom';

const KEY_BASE = 'ascended_custom_goal_types_v1_';
export const customGoalTypesKey = (userId: string | undefined) => KEY_BASE + (userId || 'guest');
export const CUSTOM_GOAL_TYPES_EVENT = 'ascended-custom-goal-types';
const DAMAGED_MESSAGE = 'The saved custom goal types could not be read, so they were not changed. Restore a backup in Settings to replace them.';

function parseStoredList(raw: unknown): CustomGoalType[] {
  if (!Array.isArray(raw)) return [];
  const valid: CustomGoalType[] = [];
  for (const item of raw) {
    const parsed = CustomGoalTypeSchema.safeParse(item);
    if (parsed.success) valid.push(parsed.data);
  }
  return valid;
}

export function getCustomGoalTypes(userId: string | undefined): CustomGoalType[] {
  try {
    const stored = secureStore.getItem(customGoalTypesKey(userId));
    if (!stored || stored === '\u0000damaged') return [];
    return parseStoredList(JSON.parse(stored));
  } catch {
    return [];
  }
}

export function isCustomGoalTypesDamaged(userId: string | undefined): boolean {
  return secureStore.isUndecryptable(customGoalTypesKey(userId));
}

export function saveCustomGoalTypes(userId: string | undefined, types: CustomGoalType[]) {
  if (isCustomGoalTypesDamaged(userId)) throw new Error(DAMAGED_MESSAGE);
  saveCustomGoalTypesNow(userId, types);
}

/** Saves custom goal types even when the saved ones couldn't be read (a restore replacing damaged data). */
export function saveCustomGoalTypesForRestore(userId: string | undefined, types: CustomGoalType[]) {
  secureStore.clearUndecryptable(customGoalTypesKey(userId));
  saveCustomGoalTypesNow(userId, types);
}

function saveCustomGoalTypesNow(userId: string | undefined, types: CustomGoalType[]) {
  try {
    secureStore.setItem(customGoalTypesKey(userId), JSON.stringify(types));
  } catch (error) {
    if (error instanceof Error && error.message === 'Locked') throw error;
    throw new Error('The custom goal types could not be saved on this device (storage is full or unavailable).');
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CUSTOM_GOAL_TYPES_EVENT));
  }
}

/**
 * Whether an assigned goal or template holds an older snapshot of a custom goal type that has since been edited in
 * Settings. Goals keep their own copy so edits don't silently rewrite past sessions, and offer an explicit update.
 */
export function findNewerCustomGoalType(
  goalOrTemplate: Pick<Goal, 'type' | 'customType'> | Pick<GoalTemplate, 'type' | 'customType'>,
  library: CustomGoalType[],
): CustomGoalType | null {
  if (goalOrTemplate.type !== 'CUSTOM' || !goalOrTemplate.customType) return null;
  const latest = library.find(t => t.id === goalOrTemplate.customType!.id);
  if (!latest) return null;
  return latest.version > (goalOrTemplate.customType.version || 1) ? latest : null;
}

/** Returns a copy of a goal or template updated to the latest version of its custom goal type. */
export function applyCustomGoalTypeUpdate<T extends { type: string; customType?: CustomGoalType }>(
  item: T,
  latest: CustomGoalType,
): T {
  return {
    ...item,
    customType: cloneCustomGoalType(latest),
  };
}

/** Formats custom goal types as a shareable JSON file. */
export function exportCustomGoalTypesJson(types: CustomGoalType[]): string {
  return JSON.stringify(
    {
      app: 'AscendEd',
      kind: 'custom-goal-types',
      version: 1,
      exportedAt: new Date().toISOString(),
      customGoalTypes: types,
    },
    null,
    2,
  );
}

/** Parses an exported custom goal types JSON file (or a raw JSON array of CustomGoalType objects). */
export function parseCustomGoalTypesImport(text: string): CustomGoalType[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).customGoalTypes)
      ? (parsed as Record<string, unknown>).customGoalTypes as unknown[]
      : null;
  if (!list) {
    throw new Error('This file does not contain a list of custom goal types.');
  }
  const valid = parseStoredList(list);
  if (list.length > 0 && valid.length === 0) {
    throw new Error('None of the custom goal types in this file were valid.');
  }
  return valid;
}

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
    const checked = CustomGoalTypeSchema.parse(candidate);
    const next = existing
      ? all.map(t => (t.id === existing.id ? checked : t))
      : [...all, checked];
    saveCustomGoalTypes(userId, next);
    return checked;
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
