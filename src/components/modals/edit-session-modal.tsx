
'use client';

import React, { useState, useEffect } from 'react';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { useStudentData } from '@/hooks/use-student-data';
import type { SessionData, Goal, SessionGoalData } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { GOAL_TYPE_FIELDS } from '@/lib/goal-constants';
import { formatDate } from '@/lib/helpers';


interface EditSessionModalProps {
  sessionToEdit: SessionData | null;
}

const GoalDataInputComponent = React.lazy(() => import('@/components/forms/goal-data-input'));

export default function EditSessionModal({ sessionToEdit }: EditSessionModalProps) {
  const {
    sessions,
    students,
    closeEditSessionModal,
    updateSession,
    loading: dataLoading
  } = useStudentData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const currentSession = sessions.find(s => s.sessionId === sessionToEdit?.sessionId) || null;

  const [formData, setFormData] = useState<Partial<SessionData>>({});

  // Older or imported sessions may lack the goal list they were recorded with; fall back to the student's goals.
  const goalHeaders: Goal[] = currentSession?.originalGoalHeaders
    ?? students.find(s => s.id === currentSession?.studentId)?.goals
    ?? [];

  useEffect(() => {
    if (currentSession) {
      // Ensure date is in 'YYYY-MM-DD' for DatePicker if it's from an ISO string (left empty if it can't be read).
      const parsed = currentSession.date ? new Date(currentSession.date) : null;
      setFormData({
        ...currentSession,
        goals: currentSession.goals ?? [],
        date: parsed && !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : undefined,
      });
    }
  }, [currentSession]);


  const handleInputChange = (field: keyof Pick<SessionData, 'activity' | 'notes' | 'time' | 'endTime'>, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (date: Date | undefined) => {
    // Store date as 'YYYY-MM-DD' string in formData for consistency with initial setup
    setFormData(prev => ({ ...prev, date: date ? date.toISOString().split('T')[0] : undefined }));
  };

  const handleGoalDataChange = (goalId: string, updatedFieldName: string, goalData: SessionGoalData['data']) => {
    setFormData(prev => {
      const updatedGoals = prev.goals?.map(g =>
        g.goalId === goalId ? { ...g, data: goalData } : g
      ) || [];
      return { ...prev, goals: updatedGoals };
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!currentSession || !formData.date) {
        toast({ title: "Error", description: "Session data or date is missing.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);

    // Reconstruct full ISO date string for submission.
    // formData.date is 'YYYY-MM-DD'. new Date('YYYY-MM-DD') parses as local midnight.
    // We need to combine this with formData.time correctly.
    let finalDateISO = '';
    const datePart = formData.date; // YYYY-MM-DD

    if (formData.time) {
        const [hours, minutes] = formData.time.split(':');
        // Create date object with local date and time, then convert to ISO string (which will be UTC)
        const localDateTime = new Date(datePart);
        localDateTime.setHours(Number(hours), Number(minutes), 0, 0);
        
        if (!isNaN(localDateTime.getTime())) {
            finalDateISO = localDateTime.toISOString();
        } else {
            // Fallback if time parsing fails, just use date (midnight UTC)
            finalDateISO = new Date(datePart).toISOString();
        }
    } else {
        // If no time, use date (midnight UTC)
        finalDateISO = new Date(datePart).toISOString();
    }


    const dataToUpdate: Partial<SessionData> = {
        ...formData,
        date: finalDateISO,
    };

    await updateSession(currentSession.sessionId, dataToUpdate);
    setIsSubmitting(false);
    closeEditSessionModal();
  };

  if (!currentSession) return null;

  return (
    <GenericModal
      isOpen={!!currentSession}
      onClose={closeEditSessionModal}
      title={`Edit Session for ${currentSession.studentName}`}
      description={`Session on ${formatDate(currentSession.date)}`}
      size="xl"
    >
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleSubmit();
          }
        }}
        className="space-y-4"
      >
        <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 p-4"> {/* Apply padding to the inner div */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <Label htmlFor="sessionDateEdit">Session Date</Label>
                        <DatePicker
                            date={formData.date ? new Date(formData.date) : undefined}
                            setDate={handleDateChange}
                        />
                    </div>
                    <div>
                        <Label htmlFor="sessionTimeEdit">Start Time</Label>
                        <Input
                            id="sessionTimeEdit"
                            type="time"
                            value={formData.time || ''}
                            onChange={(e) => handleInputChange('time', e.target.value)}
                        />
                    </div>
                     <div>
                        <Label htmlFor="sessionEndTimeEdit">End Time</Label>
                        <Input
                            id="sessionEndTimeEdit"
                            type="time"
                            value={formData.endTime || ''}
                            onChange={(e) => handleInputChange('endTime', e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <Label htmlFor="sessionActivityEdit">Activity</Label>
                    <Input
                    id="sessionActivityEdit"
                    placeholder="Describe the session activity"
                    value={formData.activity || ''}
                    onChange={(e) => handleInputChange('activity', e.target.value)}
                    />
                </div>

                <React.Suspense fallback={<div>Loading Goal Inputs...</div>}>
                    {formData.goals && formData.goals.length > 0 && (
                        <ScrollArea className="max-h-[300px] border rounded-md p-2">
                            <div className="space-y-3">
                                {formData.goals.map((sessionGoal) => {
                                    const originalGoal = goalHeaders.find(og => og.id === sessionGoal.goalId);
                                    if (!originalGoal) return null;

                                    return (
                                        <GoalDataInputComponent
                                        key={sessionGoal.goalId}
                                        id={`edit-session-goal-${sessionGoal.goalId}`}
                                        goal={originalGoal}
                                        data={sessionGoal.data || GOAL_TYPE_FIELDS[(originalGoal.dataCaptureType || originalGoal.type) as keyof typeof GOAL_TYPE_FIELDS]}
                                        onChange={(fieldName,newData) => handleGoalDataChange(sessionGoal.goalId, fieldName,newData)}
                                        isArchived={originalGoal.isArchived}
                                        />
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </React.Suspense>

                <div>
                    <Label htmlFor="sessionNotesEdit">General Notes</Label>
                    <Textarea
                    id="sessionNotesEdit"
                    placeholder="Any additional observations or notes"
                    value={formData.notes || ''}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    rows={3}
                    />
                </div>
            </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t p-4">
          <Button type="button" variant="outline" onClick={closeEditSessionModal} disabled={isSubmitting || dataLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || dataLoading}>
            {isSubmitting || dataLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </GenericModal>
  );
}
