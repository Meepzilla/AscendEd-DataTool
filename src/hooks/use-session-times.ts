'use client';

import { parseDateOnly } from '@/lib/helpers';
import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultSessionTimes, previousSessionTimes } from '@/lib/session-time';

// Data Entry's session date and start and end times.
//
// They follow "now" unless the teacher set them. The page can stay open all day (or for days): when data entry
// starts for a new session (the first entry after everything was saved), the date moves to today and the times
// to now; when the app comes back to the foreground on a later day with nothing entered, the date moves to
// today. A past date or a time chosen in the pickers is kept: the date until it is changed back (or Reset Time
// to Now), the times until that session is saved. Reset Time to Before marks the 30-minute chunk that just
// ended (now minus 30 minutes to now) for recording a session that just happened, and counts as a chosen
// time. Unsaved entries restored from another day keep their date and times until they are saved.

interface Options {
  /** The restored draft's date and times (when it had entries), else undefined to start now. */
  initial?: { date?: string; time?: string; endTime?: string };
  /** Whether any student on screen has something entered that isn't saved. */
  anyUnsaved: boolean;
  /** Whether the students' card states are built yet (until then, what's entered isn't known). */
  statesBuilt: boolean;
}

/** A stored date, or now when there is none or it can't be read. */
const dateOrNow = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export function useSessionTimes({ initial, anyUnsaved, statesBuilt }: Options) {
  const [sessionDate, setSessionDate] = useState<Date | undefined>(() => dateOrNow(initial?.date));
  const [sessionTime, setSessionTime] = useState<string>(() => initial?.time || '');
  const [sessionEndTime, setSessionEndTime] = useState<string>(() => initial?.endTime || '');

  useEffect(() => {
    if (sessionTime === '') {
      const { start, end } = defaultSessionTimes();
      setSessionTime(start);
      setSessionEndTime(end);
    }
  }, [sessionTime]);

  // A date restored from the draft that isn't today was chosen by the teacher: it stays for the next student's session
  // too, as it did before the page was left (only the date itself was restored, so it used to become today).
  const pastDateChosenRef = useRef<boolean | null>(null);
  if (pastDateChosenRef.current === null) {
    const restored = initial?.date ? parseDateOnly(initial.date) : null;
    pastDateChosenRef.current = !!restored && !Number.isNaN(restored.getTime()) && restored.toDateString() !== new Date().toDateString();
  }
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
  const resetSessionToBefore = useCallback(() => {
    pastDateChosenRef.current = false;
    // The before window is a chosen time, not a default: without this, the first entry typed would
    // move the times back to now and the 30 minutes from now, discarding the chunk just marked.
    timeChosenRef.current = true;
    const now = new Date();
    const { start, end } = previousSessionTimes(now);
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

  // Read when the app comes back to the foreground: something is entered, or that isn't known yet.
  const hasEntriesNowRef = useRef(false);
  hasEntriesNowRef.current = !statesBuilt || anyUnsaved;
  useEffect(() => {
    const refreshDate = () => {
      if (document.visibilityState !== 'visible') return;
      const now = new Date();
      if (pastDateChosenRef.current || !sessionDate || sessionDate.toDateString() === now.toDateString()) return;
      if (hasEntriesNowRef.current) return;
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

  return { sessionDate, sessionTime, sessionEndTime, chooseSessionDate, chooseSessionTime, chooseSessionEndTime, resetSessionToNow, resetSessionToBefore };
}
