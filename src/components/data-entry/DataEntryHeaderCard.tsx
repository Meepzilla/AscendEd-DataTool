
'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronUp, Edit2, Lock, LockOpen } from 'lucide-react';
import SessionDateTimePickers from './SessionDateTimePickers';

interface DataEntryHeaderCardProps {
  isHeaderCardCollapsed: boolean;
  setIsHeaderCardCollapsed: (collapsed: boolean) => void;
  dataEntrySessionDate: Date | undefined;
  setDataEntrySessionDate: (date: Date | undefined) => void;
  dataEntrySessionTime: string;
  setDataEntrySessionTime: (time: string) => void;
  dataEntrySessionEndTime: string;
  setDataEntrySessionEndTime: (time: string) => void;
  /** Reset Time to Now (today, now, and the date and times follow "now" again). */
  onResetToNow?: () => void;
  /** Reset Time to Before (today, the 30-minute chunk that just ended). */
  onResetToBefore?: () => void;
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
  onResetToNow,
  onResetToBefore,
  isStudentAccessLocked,
  setIsStudentAccessLocked,
}) => {

  return (
    <Card className="shadow-lg flex-shrink-0">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Edit2 className="h-7 w-7 text-primary" />
            <CardTitle role="heading" aria-level={1} className="text-2xl font-bold">Data Entry</CardTitle>
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
          <CardDescription>Record session data for students. Use hotkeys for speed.</CardDescription>
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
              onResetToNow={onResetToNow}
              onResetToBefore={onResetToBefore}
              locked={isStudentAccessLocked}
            />
            <div className="flex items-center space-x-2 border p-2 rounded-md bg-muted/50">
              {isStudentAccessLocked ? <Lock className="h-5 w-5 text-destructive" /> : <LockOpen className="h-5 w-5 text-green-500" />}
              <Label htmlFor="student-access-lock" className="text-sm font-medium">
                Student Access Lock
              </Label>
              <Switch
                id="student-access-lock"
                checked={isStudentAccessLocked}
                onCheckedChange={setIsStudentAccessLocked}
                aria-label="Toggle Student Access Lock"
              />
            </div>
          </div>

          {/* Hidden on touch screens without a keyboard (iPad, phone), where hotkeys can't be used. */}
          <p className="text-sm text-muted-foreground touch:hidden">
            Hotkeys: 1-4 Focus slots | A/Alt+A Cycle Students | S/Alt+S Cycle Goals | C/N/B for counts | D/V/G/P/I for prompts | Ctrl+Enter Save. See Help.
          </p>
        </CardContent>
      )}
    </Card>
  );
};

export default DataEntryHeaderCard;
