'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultSessionTimes } from '@/lib/session-time';

// Data Entry's session date and start and end times.
//
// They follow "now" unless the teacher set them. The page can stay open all day (or for days): when data entry
// starts for a new session (the first entry after everything was saved), the date moves to today and the times
// to now; when the app comes back to the foreground on a later day with nothing entered, the date moves to
// today. A past date or a time chosen in the pickers is kept: the date until it is changed back (or Reset Time
// to Now), the times until that session is saved. Unsaved entries restored from another day keep their date and
// times until they are saved.

interface Options {
  /** The restored draft's date and times (when it had entries), else undefined to start now. */
  initial?: { date?: string; time?: string; endTime?: string };
  /** Whether any student on screen has something entered that isn't saved. */
  anyUnsaved: boolean;
  /** Whether the students' card states are built yet (until then, what's entered isn't known). */
  statesBuilt: boolean;
  /** Read when the app comes back: true when something is entered, or when that isn't known yet. */
  hasEntriesNow: () => boolean;
}

export function useSessionTimes({ initial, anyUnsaved, statesBuilt, hasEntriesNow }: Options) {
  const [sessionDate, setSessionDate] = useState<Date | undefined>(() => (initial?.date ? new Date(initial.date) : new Date()));
  const [sessionTime, setSessionTime] = useState<string>(() => initial?.time || '');
  const [sessionEndTime, setSessionEndTime] = useState<string>(() => initial?.endTime || '');

  useEffect(() => {
    if (sessionTime === '') {
      const { start, end } = defaultSessionTimes();
      setSessionTime(start);
      setSessionEndTime(end);
    }
  }, [sessionTime]);

  const pastDateChosenRef = useRef(false);
  const timeChosenRef = useRef(false);
  const chooseSessionDate = useCallback((date: Date | undefined) => {
    pastDateChosenRef.current = !!date && date.toDateString() !== new Date().toDateString();
    setSessionDate(date);
  }, []);
  const chooseSessionTime = useCallback((time: string) => { timeChosenRef.current = true; setSessionTime(time); }, []);
  const chooseSessionEndTime = useCallback((time: string) => { timeChosenRef.current = true; setSessionEndTime(time); }, []);
  const resetSessionToNow = useCallback(() => {
    pastDateChosenRef.current = false;
    timeChosenRef.current = false;
    const now = new Date();
    const { start, end } = defaultSessionTimes(now);
    setSessionDate(now);
    setSessionTime(start);
    setSessionEndTime(end);
  }, []);

  const prevUnsavedRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!statesBuilt) return;
    const previous = prevUnsavedRef.current;
    prevUnsavedRef.current = anyUnsaved;
    // The first look (restored entries included) only records the state.
    if (previous === null || previous === anyUnsaved) return;
    if (!anyUnsaved) {
      // Everything saved (or reset): the times chosen were for that session.
      timeChosenRef.current = false;
      return;
    }
    // A new session's first entry.
    if (pastDateChosenRef.current) return;
    const now = new Date();
    setSessionDate(now);
    if (!timeChosenRef.current) {
      const { start, end } = defaultSessionTimes(now);
      setSessionTime(start);
      setSessionEndTime(end);
    }
  }, [anyUnsaved, statesBuilt]);

  const hasEntriesNowRef = useRef(hasEntriesNow);
  hasEntriesNowRef.current = hasEntriesNow;
  useEffect(() => {
    const refreshDate = () => {
      if (document.visibilityState !== 'visible') return;
      const now = new Date();
      if (pastDateChosenRef.current || !sessionDate || sessionDate.toDateString() === now.toDateString()) return;
      if (hasEntriesNowRef.current()) return;
      const { start, end } = defaultSessionTimes(now);
      timeChosenRef.current = false;
      setSessionDate(now);
      setSessionTime(start);
      setSessionEndTime(end);
    };
    refreshDate();
    document.addEventListener('visibilitychange', refreshDate);
    window.addEventListener('focus', refreshDate);
    return () => {
      document.removeEventListener('visibilitychange', refreshDate);
      window.removeEventListener('focus', refreshDate);
    };
  }, [sessionDate]);

  return { sessionDate, sessionTime, sessionEndTime, chooseSessionDate, chooseSessionTime, chooseSessionEndTime, resetSessionToNow };
}
