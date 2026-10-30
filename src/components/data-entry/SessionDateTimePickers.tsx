
'use client';

import React from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { defaultSessionTimes, DEFAULT_SESSION_MINUTES } from '@/lib/session-time';

interface SessionDateTimePickersProps {
  dataEntrySessionDate: Date | undefined;
  setDataEntrySessionDate: (date: Date | undefined) => void;
  dataEntrySessionTime: string;
  setDataEntrySessionTime: (time: string) => void;
  dataEntrySessionEndTime: string;
  setDataEntrySessionEndTime: (time: string) => void;
  /** Student Access Lock: the date and times can't be changed. */
  locked?: boolean;
}

const SessionDateTimePickers: React.FC<SessionDateTimePickersProps> = ({
  dataEntrySessionDate,
  setDataEntrySessionDate,
  dataEntrySessionTime,
  setDataEntrySessionTime,
  dataEntrySessionEndTime,
  setDataEntrySessionEndTime,
  locked = false,
}) => {
  // Starts the session now: today's date, the current time, and the default length.
  const resetToNow = () => {
    const now = new Date();
    const { start, end } = defaultSessionTimes(now);
    setDataEntrySessionDate(now);
    setDataEntrySessionTime(start);
    setDataEntrySessionEndTime(end);
  };

  return (
    // A disabled fieldset disables every button in it (the pickers open from buttons).
    <fieldset disabled={locked} className="grid grid-cols-2 gap-x-4 gap-y-2 items-center disabled:opacity-60" title={locked ? 'Unlock Student Access to change the date or time' : undefined}>
      <div className="w-full">
        <Label htmlFor="sessionDate" className="block text-sm font-medium mb-1">Session Date</Label>
        <DatePicker date={dataEntrySessionDate} setDate={setDataEntrySessionDate} />
      </div>
      <div className="w-full">
        <Label htmlFor="sessionTime" className="block text-sm font-medium mb-1">Start Time</Label>
        <TimePicker id="sessionTime" value={dataEntrySessionTime} onChange={setDataEntrySessionTime} />
      </div>
      <div className="w-full col-span-2 sm:col-span-1">
        <Label htmlFor="sessionEndTime" className="block text-sm font-medium mb-1">End Time</Label>
        <TimePicker id="sessionEndTime" value={dataEntrySessionEndTime} onChange={setDataEntrySessionEndTime} />
      </div>
      <div className="w-full col-span-2 sm:col-span-1 self-end">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={resetToNow}
          title={`Set the date to today, the start time to now and the end time to ${DEFAULT_SESSION_MINUTES} minutes from now`}
        >
          <RotateCcw className="mr-2 h-4 w-4" /> Reset Time to Now
        </Button>
      </div>
    </fieldset>
  );
};

export default SessionDateTimePickers;
