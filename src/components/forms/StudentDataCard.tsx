
'use client';

import React, { Suspense, lazy } from 'react';
import type { Student, StudentSessionState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, XCircle, Eye, EyeOff, Loader2, Lightbulb } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { GOAL_TYPE_FIELDS } from '@/lib/goal-constants';

const GoalDataInputComponent = lazy(() => import('@/components/forms/goal-data-input'));

interface StudentDataCardProps {
  student: Student;
  state: StudentSessionState;
  slotIndex: number;
  isStudentFocused: boolean;
  availableStudentsForDropdown: Student[];
  dataEntrySelectedStudentIds: string[];
  dataEntryShowArchivedByStudentId: Record<string, boolean>;
  dataEntryVisibleGoalCountByStudentId: Record<string, number>;
  dataEntryFocusedGoalIndexByStudentId: Record<string, number>;
  dataEntryAiActivitySuggestions: Record<string, string[]>;
  isAiLoading: Record<string, boolean>;
  setDataEntryFocusedStudentSlotIndex: (index: number) => void;
  openEditStudentModal: (student: Student) => void;
  handleStudentSelect: (studentId: string, index: number) => void;
  removeStudentSlot: (index: number) => void;
  handleInputChange: (studentId: string, field: 'activity' | 'notes', value: string) => void;
  setDataEntryShowArchivedByStudentId: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setDataEntryVisibleGoalCountByStudentId: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  handleGoalDataChange: (studentId: string, goalId: string, updatedField: any, newData: any) => void;
  handleMoveGoal: (studentId: string, goalId: string, direction: 'up' | 'down') => void;
  handleLocalAiFetch: (studentId: string) => void;
  isStudentAccessLocked: boolean;
}

const StudentDataCard: React.FC<StudentDataCardProps> = ({
  student,
  state,
  slotIndex,
  isStudentFocused,
  availableStudentsForDropdown,
  dataEntrySelectedStudentIds,
  dataEntryShowArchivedByStudentId,
  dataEntryVisibleGoalCountByStudentId,
  dataEntryFocusedGoalIndexByStudentId,
  dataEntryAiActivitySuggestions,
  isAiLoading,
  setDataEntryFocusedStudentSlotIndex,
  openEditStudentModal,
  handleStudentSelect,
  removeStudentSlot,
  handleInputChange,
  setDataEntryShowArchivedByStudentId,
  setDataEntryVisibleGoalCountByStudentId,
  handleGoalDataChange,
  handleMoveGoal,
  handleLocalAiFetch,
  isStudentAccessLocked,
}) => {
  const showArchived = dataEntryShowArchivedByStudentId[student.id] || false;
  const allStudentGoals = state.originalGoalHeaders;
  const filteredStudentGoals = allStudentGoals.filter(g => !g.isArchived || showArchived);
  const visibleGoalCount = dataEntryVisibleGoalCountByStudentId[student.id] ?? 10;
  const displayedGoals = filteredStudentGoals.slice(0, visibleGoalCount);

  return (
    <Card
      id={`student-card-slot-${slotIndex}`}
      className={cn(
        'flex flex-col transition-all duration-300 ease-in-out shadow-md flex-shrink-0 h-full',
        isStudentFocused ? 'w-[450px]' : 'w-[280px]',
        isStudentFocused && 'ring-2 ring-primary ring-offset-2 shadow-xl'
      )}
      onClick={() => setDataEntryFocusedStudentSlotIndex(slotIndex)}
    >
      <CardHeader className="bg-muted/50 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 w-full">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                openEditStudentModal(student);
              }}
              title={`Manage ${student.name}'s goals and info (Alt+E)`}
              aria-label={`Manage ${student.name}'s goals and info`}
            >
              <Users className="h-5 w-5 text-primary" />
            </Button>
            <Select value={student.id} onValueChange={(newStudentId) => handleStudentSelect(newStudentId, slotIndex)}>
              <SelectTrigger className="flex-grow truncate">
                <SelectValue placeholder="Select Student" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={student.id} key={student.id} disabled={dataEntrySelectedStudentIds.includes(student.id) && student.id !== student.id}>
                  {student.name}
                </SelectItem>
                {availableStudentsForDropdown.map(s => (
                  <SelectItem value={s.id} key={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center">
            {dataEntrySelectedStudentIds.length > 0 && (
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeStudentSlot(slotIndex); }} className="h-8 w-8" title="Remove Student Slot">
                <XCircle className="h-5 w-5 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <ScrollArea className="flex-grow">
        <CardContent className="p-3 space-y-3">
          <div>
            <Label htmlFor={`activity-${student.id}`}>Activity</Label>
            <Input
              id={`activity-${student.id}`}
              placeholder="Describe the session activity"
              value={state.activity}
              onChange={(e) => handleInputChange(student.id, 'activity', e.target.value)}
              disabled={isStudentAccessLocked}
            />
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <Switch
              id={`show-archived-${student.id}`}
              checked={dataEntryShowArchivedByStudentId[student.id] || false}
              onCheckedChange={(checked) => setDataEntryShowArchivedByStudentId(prev => ({ ...prev, [student.id]: checked }))}
            />
            <Label htmlFor={`show-archived-${student.id}`} className="text-xs text-muted-foreground">
              {dataEntryShowArchivedByStudentId[student.id] ? "Showing Archived Goals" : "Show Archived Goals"}
            </Label>
          </div>

          {allStudentGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center border rounded-md">No goals assigned. Assign goals in Student Profile.</p>
          ) : displayedGoals.length === 0 && !showArchived ? (
            <p className="text-sm text-muted-foreground p-4 text-center border rounded-md">No active goals. Toggle "Show Archived Goals" to view them.</p>
          ) : displayedGoals.length === 0 && showArchived ? (
            <p className="text-sm text-muted-foreground p-4 text-center border rounded-md">No goals (active or archived) for this student.</p>
          ) : (
            <Suspense fallback={<Skeleton className="h-40 w-full" />}>
              <div className="space-y-3">
                {displayedGoals.map((goal, index) => {
                  const isGoalFocused = isStudentFocused && (dataEntryFocusedGoalIndexByStudentId[student.id] ?? 0) === index;
                  const actualGoalIndexInOriginal = allStudentGoals.findIndex(g => g.id === goal.id);

                  return (
                    <GoalDataInputComponent
                      key={goal.id}
                      id={`goal-input-${student.id}-${goal.id}`}
                      goal={goal}
                      data={state.goalData[goal.id] || GOAL_TYPE_FIELDS[goal.type]}
                      onChange={(updatedField, newData) => handleGoalDataChange(student.id, goal.id, updatedField, newData)}
                      isFocused={isGoalFocused}
                      onSetFocus={() => {
                        const visibleGoals = allStudentGoals.filter(g => !g.isArchived || dataEntryShowArchivedByStudentId[student.id]);
                        const newIndex = visibleGoals.findIndex(g => g.id === goal.id);
                        if (newIndex !== -1) {
                          setDataEntryFocusedStudentSlotIndex(slotIndex);
                          handleGoalDataChange(student.id, goal.id, 'focus', state.goalData[goal.id]);
                        }
                      }}
                      onMoveUp={() => handleMoveGoal(student.id, goal.id, 'up')}
                      onMoveDown={() => handleMoveGoal(student.id, goal.id, 'down')}
                      canMoveUp={actualGoalIndexInOriginal > 0}
                      canMoveDown={actualGoalIndexInOriginal < allStudentGoals.length - 1}
                      isArchived={goal.isArchived}
                      isLocked={isStudentAccessLocked}
                    />
                  );
                })}
                {filteredStudentGoals.length > 10 && (
                  <div className="flex justify-center mt-2">
                    {visibleGoalCount < filteredStudentGoals.length ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDataEntryVisibleGoalCountByStudentId(prev => ({ ...prev, [student.id]: filteredStudentGoals.length }))}
                        className="text-xs"
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        Show More ({filteredStudentGoals.length - visibleGoalCount} more)
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDataEntryVisibleGoalCountByStudentId(prev => ({ ...prev, [student.id]: 10 }))}
                        className="text-xs"
                      >
                        <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                        Show Less
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Suspense>
          )}

          <div>
            <Label htmlFor={`notes-${student.id}`}>General Notes</Label>
            <Textarea
              id={`notes-${student.id}`}
              placeholder="Any additional observations or notes for this student's session"
              value={state.notes}
              onChange={(e) => handleInputChange(student.id, 'notes', e.target.value)}
              rows={3}
              disabled={isStudentAccessLocked}
            />
          </div>
          <div className="border-t pt-3 space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleLocalAiFetch(student.id)}
              disabled={isAiLoading[student.id] || allStudentGoals.filter(g => !g.isArchived).length === 0}
              className="w-full"
            >
              {isAiLoading[student.id] ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Lightbulb className="mr-2 h-4 w-4" />}
              Get AI Activity Suggestions
            </Button>
            {dataEntryAiActivitySuggestions[student.id] && dataEntryAiActivitySuggestions[student.id].length > 0 && (
              <div className="p-2 border rounded-md bg-accent/30">
                <h4 className="text-xs font-semibold mb-1">Suggested Activities:</h4>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  {dataEntryAiActivitySuggestions[student.id].map((sugg, i) => <li key={i}>{sugg}</li>)}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </ScrollArea>
    </Card>
  );
};

export default StudentDataCard;

    