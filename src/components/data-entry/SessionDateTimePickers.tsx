
'use client';

import React from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SessionDateTimePickersProps {
  dataEntrySessionDate: Date | undefined;
  setDataEntrySessionDate: (date: Date | undefined) => void;
  dataEntrySessionTime: string;
  setDataEntrySessionTime: (time: string) => void;
  dataEntrySessionEndTime: string;
  setDataEntrySessionEndTime: (time: string) => void;
}

const SessionDateTimePickers: React.FC<SessionDateTimePickersProps> = ({
  dataEntrySessionDate,
  setDataEntrySessionDate,
  dataEntrySessionTime,
  setDataEntrySessionTime,
  dataEntrySessionEndTime,
  setDataEntrySessionEndTime,
}) => {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 items-center">
      <div className="w-full">
        <Label htmlFor="sessionDate" className="block text-sm font-medium mb-1">Session Date</Label>
        <DatePicker date={dataEntrySessionDate} setDate={setDataEntrySessionDate} />
      </div>
      <div className="w-full">
        <Label htmlFor="sessionTime" className="block text-sm font-medium mb-1">Start Time</Label>
        <Input
          id="sessionTime"
          type="time"
          value={dataEntrySessionTime}
          onChange={(e) => setDataEntrySessionTime(e.target.value)}
          className="w-full"
        />
      </div>
      <div className="w-full col-span-2 sm:col-span-1">
        <Label htmlFor="sessionEndTime" className="block text-sm font-medium mb-1">End Time</Label>
        <Input
          id="sessionEndTime"
          type="time"
          value={dataEntrySessionEndTime}
          onChange={(e) => setDataEntrySessionEndTime(e.target.value)}
          className="w-full"
        />
      </div>
    </div>
  );
};

export default SessionDateTimePickers;
