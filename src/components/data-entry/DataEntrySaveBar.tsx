'use client';

import React, { type ComponentProps, type Ref } from 'react';
import { ChevronLeft, ChevronRight, PlusCircle, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TouchControls from '@/components/forms/touch-controls';
import LoadGroupMenu from '@/components/student-groups/LoadGroupMenu';
import type { StudentGroup } from '@/lib/student-groups';

// Data Entry's bar at the bottom of the screen: Student and Goal at the left, Load Group and the scroll arrows in
// the middle (on the Student button's line), and Add Student, Reset and the save buttons at the right.

interface Props {
  barRef: Ref<HTMLDivElement>;
  touchControls: ComponentProps<typeof TouchControls>;
  onLoadGroup: (group: StudentGroup) => void;
  isStudentAccessLocked: boolean;
  cardScroll: { left: boolean; right: boolean };
  onScrollCards: (direction: -1 | 1) => void;
  canAddStudent: boolean;
  onAddStudent: () => void;
  onReset: () => void;
  onSave: () => void;
  onSaveAll: () => void;
  isSaving: boolean;
  isSavingAll: boolean;
}

export default function DataEntrySaveBar({
  barRef, touchControls, onLoadGroup, isStudentAccessLocked, cardScroll, onScrollCards,
  canAddStudent, onAddStudent, onReset, onSave, onSaveAll, isSaving, isSavingAll,
}: Props) {
  const busy = isSaving || isSavingAll;
  return (
    <div ref={barRef} className="sticky bottom-0 left-0 right-0 z-10 bg-background mt-auto">
      <div className="flex flex-wrap justify-between items-center gap-2 p-2 border-t">
        <div className="self-start">
          <TouchControls {...touchControls} />
        </div>

        {/* Takes the space between the two groups: Load Group, then the scroll arrows, centred on the
            Student button's line. */}
        <div className="flex flex-1 justify-center gap-2 self-start">
          <LoadGroupMenu onLoad={onLoadGroup} disabled={isStudentAccessLocked} size="sm" />
          <div className="flex gap-1" role="group" aria-label="Scroll students">
            <Button type="button" variant="outline" size="sm" className="w-14" onClick={() => onScrollCards(-1)} disabled={!cardScroll.left} aria-label="Scroll students left" title="Scroll students left">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button type="button" variant="outline" size="sm" className="w-14" onClick={() => onScrollCards(1)} disabled={!cardScroll.right} aria-label="Scroll students right" title="Scroll students right">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 ml-auto">
          {/* Always in view, unlike the Add Student Slot card at the far end of the slots. */}
          <Button variant="outline" onClick={onAddStudent} size="lg" aria-label="Add Student Slot"
            disabled={!canAddStudent} title="Add another student slot (Alt+W)">
            <PlusCircle className="mr-2 h-5 w-5" />
            Add<span className="hidden sm:inline">&nbsp;Student</span>
          </Button>
          <Button variant="outline" onClick={onReset} disabled={busy} size="lg" aria-label="Reset Focused">
            <RotateCcw className="mr-2 h-5 w-5" />
            Reset<span className="hidden sm:inline">&nbsp;Focused</span>
          </Button>
          <Button onClick={onSave} disabled={busy} size="lg" aria-label="Save Focused">
            <Save className="mr-2 h-5 w-5" />
            {isSaving ? 'Saving...' : <>Save<span className="hidden sm:inline">&nbsp;Focused</span></>}
          </Button>
          <Button onClick={onSaveAll} disabled={busy} size="lg">
            <Save className="mr-2 h-5 w-5" />
            {isSavingAll ? 'Saving All...' : 'Save All'}
          </Button>
        </div>
      </div>
    </div>
  );
}
