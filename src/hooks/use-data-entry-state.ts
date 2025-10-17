
'use client';

import { useState, useEffect, useCallback } from 'react';

const getLocalStorageKey = (base: string, uid: string | undefined): string | null => {
  if (!uid) return null;
  return `${base}_${uid}`;
};

const getFromLocalStorage = (key: string | null, defaultValue: any) => {
    if (typeof window === 'undefined' || !key) return defaultValue;
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.warn(`Error reading from localStorage key "${key}":`, error);
        return defaultValue;
    }
};

const DATA_ENTRY_STORAGE_KEYS = {
    DATE: 'ascended_de_v2_date',
    TIME: 'ascended_de_v2_time',
    END_TIME: 'ascended_de_v2_end_time',
    SELECTED_IDS: 'ascended_de_v2_selected_ids',
    SESSION_STATES: 'ascended_de_v2_session_states',
    FOCUSED_SLOT: 'ascended_de_v2_focused_slot',
    FOCUSED_GOALS: 'ascended_de_v2_focused_goals',
    VISIBLE_COUNTS: 'ascended_de_v2_visible_counts',
    SHOW_ARCHIVED: 'ascended_de_v2_show_archived',
};

const getDataEntryStorageKeys = (uid: string | undefined) => {
    if (!uid) return Object.fromEntries(Object.keys(DATA_ENTRY_STORAGE_KEYS).map(k => [k, null]));
    const prefix = `ascended_de_v2_${uid}_`;
    return {
        DATE: `${prefix}date`,
        TIME: `${prefix}time`,
        END_TIME: `${prefix}end_time`,
        SELECTED_IDS: `${prefix}selected_ids`,
        SESSION_STATES: `${prefix}session_states`,
        FOCUSED_SLOT: `${prefix}focused_slot`,
        FOCUSED_GOALS: `${prefix}focused_goals`,
        VISIBLE_COUNTS: `${prefix}visible_counts`,
        SHOW_ARCHIVED: `${prefix}show_archived`,
    };
};

export function useDataEntryState(uid: string | undefined) {
    const [dataEntrySessionDate, setDataEntrySessionDate] = useState<Date | undefined>(undefined);
    const [dataEntrySessionTime, setDataEntrySessionTime] = useState<string>('');
    const [dataEntrySessionEndTime, setDataEntrySessionEndTime] = useState<string>('');
    const [dataEntrySelectedStudentIds, setDataEntrySelectedStudentIds] = useState<string[]>([]);
    const [dataEntryStudentSessionStates, setDataEntryStudentSessionStates] = useState<Record<string, any>>({});
    const [dataEntryFocusedStudentSlotIndex, setDataEntryFocusedStudentSlotIndex] = useState<number>(0);
    const [dataEntryFocusedGoalIndexByStudentId, setDataEntryFocusedGoalIndexByStudentId] = useState<Record<string, number>>({});
    const [dataEntryAiActivitySuggestions, setDataEntryAiActivitySuggestions] = useState<Record<string, string[]>>({});
    const [dataEntryVisibleGoalCountByStudentId, setDataEntryVisibleGoalCountByStudentId] = useState<Record<string, number>>({});
    const [dataEntryShowArchivedByStudentId, setDataEntryShowArchivedByStudentId] = useState<Record<string, boolean>>({});
    const [isStudentAccessLocked, setIsStudentAccessLocked] = useState(false);

    // Load from local storage on mount
    useEffect(() => {
        if (uid) {
            const keys = getDataEntryStorageKeys(uid);
            const storedDate = getFromLocalStorage(keys.DATE, null);
            setDataEntrySessionDate(storedDate ? new Date(storedDate) : undefined);
            setDataEntrySessionTime(getFromLocalStorage(keys.TIME, ''));
            setDataEntrySessionEndTime(getFromLocalStorage(keys.END_TIME, ''));
            setDataEntrySelectedStudentIds(getFromLocalStorage(keys.SELECTED_IDS, []));
            setDataEntryStudentSessionStates(getFromLocalStorage(keys.SESSION_STATES, {}));
            setDataEntryFocusedStudentSlotIndex(getFromLocalStorage(keys.FOCUSED_SLOT, 0));
            setDataEntryFocusedGoalIndexByStudentId(getFromLocalStorage(keys.FOCUSED_GOALS, {}));
            setDataEntryVisibleGoalCountByStudentId(getFromLocalStorage(keys.VISIBLE_COUNTS, {}));
            setDataEntryShowArchivedByStudentId(getFromLocalStorage(keys.SHOW_ARCHIVED, {}));
        }
    }, [uid]);

    // Save to local storage on change
    useEffect(() => {
        if (uid) {
            const keys = getDataEntryStorageKeys(uid);
            if (keys.DATE) localStorage.setItem(keys.DATE, JSON.stringify(dataEntrySessionDate ? dataEntrySessionDate.toISOString() : null));
            if (keys.TIME) localStorage.setItem(keys.TIME, dataEntrySessionTime);
            if (keys.END_TIME) localStorage.setItem(keys.END_TIME, dataEntrySessionEndTime);
            if (keys.SELECTED_IDS) localStorage.setItem(keys.SELECTED_IDS, JSON.stringify(dataEntrySelectedStudentIds));
            if (keys.SESSION_STATES) localStorage.setItem(keys.SESSION_STATES, JSON.stringify(dataEntryStudentSessionStates));
            if (keys.FOCUSED_SLOT) localStorage.setItem(keys.FOCUSED_SLOT, JSON.stringify(dataEntryFocusedStudentSlotIndex));
            if (keys.FOCUSED_GOALS) localStorage.setItem(keys.FOCUSED_GOALS, JSON.stringify(dataEntryFocusedGoalIndexByStudentId));
            if (keys.VISIBLE_COUNTS) localStorage.setItem(keys.VISIBLE_COUNTS, JSON.stringify(dataEntryVisibleGoalCountByStudentId));
            if (keys.SHOW_ARCHIVED) localStorage.setItem(keys.SHOW_ARCHIVED, JSON.stringify(dataEntryShowArchivedByStudentId));
        }
    }, [
        uid, dataEntrySessionDate, dataEntrySessionTime, dataEntrySessionEndTime,
        dataEntrySelectedStudentIds, dataEntryStudentSessionStates, dataEntryFocusedStudentSlotIndex,
        dataEntryFocusedGoalIndexByStudentId, dataEntryVisibleGoalCountByStudentId,
        dataEntryShowArchivedByStudentId
    ]);

    // Default setters
    const setDate = useCallback((date: Date | undefined) => setDataEntrySessionDate(date), []);
    const setTime = useCallback((time: string) => setDataEntrySessionTime(time), []);
    const setEndTime = useCallback((time: string) => setDataEntrySessionEndTime(time), []);
    const setFocusedIndex = useCallback((index: number) => setDataEntryFocusedStudentSlotIndex(index), []);
    const setSuggestions = useCallback((suggestions: Record<string, string[]>) => setDataEntryAiActivitySuggestions(suggestions), []);
    const setVisibleCount = useCallback((updater: (prev: Record<string, number>) => Record<string, number>) => setDataEntryVisibleGoalCountByStudentId(updater), []);
    const setShowArchived = useCallback((updater: (prev: Record<string, boolean>) => Record<string, boolean>) => setDataEntryShowArchivedByStudentId(updater), []);

    return {
        dataEntrySessionDate,
        setDataEntrySessionDate: setDate,
        dataEntrySessionTime,
        setDataEntrySessionTime: setTime,
        dataEntrySessionEndTime,
        setDataEntrySessionEndTime: setEndTime,
        dataEntrySelectedStudentIds,
        setDataEntrySelectedStudentIds,
        dataEntryStudentSessionStates,
        setDataEntryStudentSessionStates,
        dataEntryFocusedStudentSlotIndex,
        setDataEntryFocusedStudentSlotIndex: setFocusedIndex,
        dataEntryFocusedGoalIndexByStudentId,
        setDataEntryFocusedGoalIndexByStudentId,
        dataEntryAiActivitySuggestions,
        setDataEntryAiActivitySuggestions: setSuggestions,
        dataEntryVisibleGoalCountByStudentId,
        setDataEntryVisibleGoalCountByStudentId: setVisibleCount,
        dataEntryShowArchivedByStudentId,
        setDataEntryShowArchivedByStudentId: setShowArchived,
        isStudentAccessLocked,
        setIsStudentAccessLocked,
    };
}
