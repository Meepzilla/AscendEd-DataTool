
'use client';

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Lock, LockOpen } from 'lucide-react';

interface StudentAccessToggleProps {
  isStudentAccessLocked: boolean;
  setIsStudentAccessLocked: (locked: boolean) => void;
}

const StudentAccessToggle: React.FC<StudentAccessToggleProps> = ({ isStudentAccessLocked, setIsStudentAccessLocked }) => {
  return (
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
  );
};

export default StudentAccessToggle;
