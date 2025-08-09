
'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DataEntryHeaderCardProps {
  isHeaderCardCollapsed: boolean;
  setIsHeaderCardCollapsed: (collapsed: boolean) => void;
  dataEntrySessionDate: Date | undefined;
  setDataEntrySessionDate: (date: Date | undefined) => void;
  dataEntrySessionTime: string;
  setDataEntrySessionTime: (time: string) => void;
  dataEntrySessionEndTime: string;
  setDataEntrySessionEndTime: (time: string) => void;
}

const DataEntryHeaderCard: React.FC<DataEntryHeaderCardProps> = ({
  isHeaderCardCollapsed,
  setIsHeaderCardCollapsed,
  dataEntrySessionDate,
  setDataEntrySessionDate,
  dataEntrySessionTime,
  setDataEntrySessionTime,
  dataEntrySessionEndTime,
  setDataEntrySessionEndTime,
}) => {
  return (
    <Card className="shadow-lg flex-shrink-0">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Edit2 className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl font-bold">Data Entry</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsHeaderCardCollapsed(!isHeaderCardCollapsed)}
            title={isHeaderCardCollapsed ? "Expand Header" : "Collapse Header"}
          >
            {isHeaderCardCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
            <span className="sr-only">{isHeaderCardCollapsed ? "Expand Header" : "Collapse Header"}</span>
          </Button>
        </div>
        {!isHeaderCardCollapsed && (
          <CardDescription>Record session data for students. AI suggests activities. Use hotkeys for speed.</CardDescription>
        )}
      </CardHeader>
      {!isHeaderCardCollapsed && (
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="w-full sm:w-auto">
              <Label htmlFor="sessionDate" className="block text-sm font-medium mb-1">Session Date</Label>
              <DatePicker date={dataEntrySessionDate} setDate={setDataEntrySessionDate} />
            </div>
            <div className="w-full sm:w-auto">
              <Label htmlFor="sessionTime" className="block text-sm font-medium mb-1">Start Time</Label>
              <Input
                id="sessionTime"
                type="time"
                value={dataEntrySessionTime}
                onChange={(e) => setDataEntrySessionTime(e.target.value)}
                className="w-full sm:w-[150px]"
              />
            </div>
            <div className="w-full sm:w-auto">
              <Label htmlFor="sessionEndTime" className="block text-sm font-medium mb-1">End Time</Label>
              <Input
                id="sessionEndTime"
                type="time"
                value={dataEntrySessionEndTime}
                onChange={(e) => setDataEntrySessionEndTime(e.target.value)}
                className="w-full sm:w-[150px]"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Hotkeys: 1-4 Focus initial slots | A/Alt+A Cycle Students | S/Alt+S Cycle Goals | C/N/D/V/G/P/F/I for prompts | Ctrl+Enter Save. See Help page for full list.
          </p>
        </CardContent>
      )}
    </Card>
  );
};

export default DataEntryHeaderCard;
