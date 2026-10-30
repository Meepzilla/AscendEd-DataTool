
'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import { AI_ENABLED } from '@/lib/features';
import SessionDateTimePickers from './SessionDateTimePickers';
import HotkeysMessage from './HotkeysMessage';
import StudentAccessToggle from './StudentAccessToggle';

interface DataEntryHeaderCardProps {
  isHeaderCardCollapsed: boolean;
  setIsHeaderCardCollapsed: (collapsed: boolean) => void;
  dataEntrySessionDate: Date | undefined;
  setDataEntrySessionDate: (date: Date | undefined) => void;
  dataEntrySessionTime: string;
  setDataEntrySessionTime: (time: string) => void;
  dataEntrySessionEndTime: string;
  setDataEntrySessionEndTime: (time: string) => void;
  isStudentAccessLocked: boolean;
  setIsStudentAccessLocked: (locked: boolean) => void;
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
  isStudentAccessLocked,
  setIsStudentAccessLocked,
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
          <CardDescription>Record session data for students.{AI_ENABLED && ' AI suggests activities.'} Use hotkeys for speed.</CardDescription>
        )}
      </CardHeader>
      {!isHeaderCardCollapsed && (
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
             <SessionDateTimePickers
              dataEntrySessionDate={dataEntrySessionDate}
              setDataEntrySessionDate={setDataEntrySessionDate}
              dataEntrySessionTime={dataEntrySessionTime}
              setDataEntrySessionTime={setDataEntrySessionTime}
              dataEntrySessionEndTime={dataEntrySessionEndTime}
              setDataEntrySessionEndTime={setDataEntrySessionEndTime}
              locked={isStudentAccessLocked}
            />
            <StudentAccessToggle
                isStudentAccessLocked={isStudentAccessLocked}
                setIsStudentAccessLocked={setIsStudentAccessLocked}
            />
          </div>
         
          <HotkeysMessage />
        </CardContent>
      )}
    </Card>
  );
};

export default DataEntryHeaderCard;
