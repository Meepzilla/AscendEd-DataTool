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
    sessions, // For checking if sessionToEdit prop still exists
    closeEditSessionModal, 
    updateSession, 
    loading: dataLoading 
  } = useStudentData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Find the session from the context's sessions array to ensure it's the latest version
  const currentSession = sessions.find(s => s.sessionId === sessionToEdit?.sessionId) || null;
  
  // Local form state, initialized from currentSession
  const [formData, setFormData] = useState<Partial<SessionData>>({});

  useEffect(() => {
    if (currentSession) {
      setFormData({
        ...currentSession,
        date: currentSession.date ? new Date(currentSession.date).toISOString().split('T')[0] : undefined, // Format for date input
      });
    }
  }, [currentSession]);


  const handleInputChange = (field: keyof Pick<SessionData, 'activity' | 'notes' | 'time'>, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (date: Date | undefined) => {
    setFormData(prev => ({ ...prev, date: date ? date.toISOString().split('T')[0] : undefined }));
  };

  const handleGoalDataChange = (goalId: string, goalData: SessionGoalData['data']) => {
    setFormData(prev => {
      const updatedGoals = prev.goals?.map(g => 
        g.goalId === goalId ? { ...g, data: goalData } : g
      ) || [];
      return { ...prev, goals: updatedGoals };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession || !formData.date) {
        toast({ title: "Error", description: "Session data or date is missing.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    
    // Reconstruct the session data with the original date format if needed, or ensure Firestore handles it
    const dataToUpdate: Partial<SessionData> = {
        ...formData,
        date: new Date(formData.date).toISOString(), // Ensure it's ISO string for consistency
    };

    await updateSession(currentSession.sessionId, dataToUpdate);
    setIsSubmitting(false);
    // Toast is handled by updateSession
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
      <form onSubmit={handleSubmit} className="space-y-4">
        <ScrollArea className="max-h-[60vh] p-1"> {/* Add padding to ScrollArea content */}
            <div className="space-y-4 p-3"> {/* Inner padding for content */}
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

                {formData.goals && formData.goals.map((sessionGoal, index) => {
                    const originalGoal = currentSession.originalGoalHeaders.find(og => og.id === sessionGoal.goalId);
                    if (!originalGoal) return null; // Should not happen

                    return (
                        <GoalDataInputComponent
                        key={sessionGoal.goalId}
                        goal={originalGoal} // Pass the original goal structure for type info
                        data={sessionGoal.data || GOAL_TYPE_FIELDS[originalGoal.type]}
                        onChange={(newData) => handleGoalDataChange(sessionGoal.goalId, newData)}
                        />
                    );
                })}
                
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
