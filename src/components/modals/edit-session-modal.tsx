
'use client';

import React, { useState, useEffect } from 'react';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { useStudentData } from '@/hooks/use-student-data';
import type { SessionData, Goal, SessionGoalData } from '@/lib/types';
import GoalDataInputComponent from '@/components/forms/goal-data-input';
import { GOAL_TYPE_FIELDS } from '@/lib/constants';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';


interface EditSessionModalProps {
  sessionToEdit: SessionData | null;
}

export default function EditSessionModal({ sessionToEdit }: EditSessionModalProps) {
  const {
    sessions,
    closeEditSessionModal,
    updateSession,
    loading: dataLoading
  } = useStudentData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const currentSession = sessions.find(s => s.sessionId === sessionToEdit?.sessionId) || null;

  const [formData, setFormData] = useState<Partial<SessionData>>({});

  useEffect(() => {
    if (currentSession) {
      setFormData({
        ...currentSession,
        // Ensure date is in 'YYYY-MM-DD' for DatePicker if it's from an ISO string
        date: currentSession.date ? new Date(currentSession.date).toISOString().split('T')[0] : undefined,
      });
    }
  }, [currentSession]);


  const handleInputChange = (field: keyof Pick<SessionData, 'activity' | 'notes' | 'time'>, value: string) => {
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

    // Reconstruct full ISO date string for submission, preserving original time if possible or defaulting.
    // new Date("YYYY-MM-DD") parses as local midnight. toISOString() converts to UTC.
    // The original time from currentSession.time should be combined with the new formData.date
    let finalDateISO = new Date(formData.date).toISOString(); // This will be UTC midnight of selected date

    if (formData.time) {
        const [hours, minutes] = formData.time.split(':');
        const datePart = formData.date; // YYYY-MM-DD
        const combinedDateTime = new Date(`${datePart}T${hours}:${minutes}:00`);
        // Check if combinedDateTime is valid, otherwise fall back to date only
        if (!isNaN(combinedDateTime.getTime())) {
            finalDateISO = combinedDateTime.toISOString();
        }
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
      description={`Session on ${new Date(currentSession.date).toLocaleDateString()} at ${currentSession.time}`}
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
        <ScrollArea className="max-h-[60vh] p-1">
            <div className="space-y-4 p-4"> {/* Apply padding to the inner div */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="sessionDateEdit">Session Date</Label>
                        <DatePicker
                            date={formData.date ? new Date(formData.date) : undefined}
                            setDate={handleDateChange}
                        />
                    </div>
                    <div>
                        <Label htmlFor="sessionTimeEdit">Session Time</Label>
                        <Input
                            id="sessionTimeEdit"
                            type="time"
                            value={formData.time || ''}
                            onChange={(e) => handleInputChange('time', e.target.value)}
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

                {formData.goals && formData.goals.length > 0 && (
                    <ScrollArea className="max-h-[300px] border rounded-md p-2">
                        <div className="space-y-3">
                            {formData.goals.map((sessionGoal) => {
                                const originalGoal = currentSession.originalGoalHeaders.find(og => og.id === sessionGoal.goalId);
                                if (!originalGoal) return null;

                                return (
                                    <GoalDataInputComponent
                                    key={sessionGoal.goalId}
                                    id={`edit-session-goal-${sessionGoal.goalId}`}
                                    goal={originalGoal}
                                    data={sessionGoal.data || GOAL_TYPE_FIELDS[originalGoal.type]}
                                    onChange={(fieldName,newData) => handleGoalDataChange(sessionGoal.goalId, fieldName,newData)}
                                    isArchived={originalGoal.isArchived}
                                    />
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}

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

