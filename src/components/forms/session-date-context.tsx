'use client';

import React, { createContext, useContext } from 'react';

// The date of the session being entered (Data Entry) or edited (Edit Session), for inputs that record a clock time:
// a time changed by hand is put on the session's day, which is the day reports look for (behavior-timing.ts).
// Also the session's length in minutes (start to end time), so behavior inputs can use it as the observation time.
const SessionDateContext = createContext<{ date?: Date; minutes?: number | null }>({});

export function SessionDateProvider({ date, minutes, children }: { date: Date | undefined; minutes?: number | null; children: React.ReactNode }) {
  const value = React.useMemo(() => ({ date, minutes }), [date, minutes]);
  return <SessionDateContext.Provider value={value}>{children}</SessionDateContext.Provider>;
}

export const useSessionDate = () => useContext(SessionDateContext).date;

/** The session's length in minutes from its start and end time, or null/undefined when not known. */
export const useSessionMinutes = () => useContext(SessionDateContext).minutes;
