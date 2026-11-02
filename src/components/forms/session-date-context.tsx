'use client';

import React, { createContext, useContext } from 'react';

// The date of the session being entered (Data Entry) or edited (Edit Session), for inputs that record a clock time:
// a time changed by hand is put on the session's day, which is the day reports look for (behavior-timing.ts).
const SessionDateContext = createContext<Date | undefined>(undefined);

export function SessionDateProvider({ date, children }: { date: Date | undefined; children: React.ReactNode }) {
  return <SessionDateContext.Provider value={date}>{children}</SessionDateContext.Provider>;
}

export const useSessionDate = () => useContext(SessionDateContext);
