
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, Goal, GoalTemplate } from '@/lib/types';
import { StudentSchema } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { XIcon, PlusCircleIcon, Archive, ArchiveRestore, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { fillNameBlanks } from '@/lib/goal-blanks';
import { TEMPLATE_PICKER_LIMIT, goalStatement, goalTypeLabel } from '@/lib/helpers';
import EditAssignedGoalModal from './edit-assigned-goal-modal';
import { cn } from '@/lib/utils';
import GoalTextPopover from '@/components/forms/GoalTextPopover';
import TemplatePickerFilters from '@/components/goal-templates/TemplatePickerFilters';
import { useTemplatePicker } from '@/hooks/use-template-picker';
import { goalFromTemplate, recordRecentTemplates } from '@/lib/goal-templates';

type EditStudentFormData = z.infer<typeof StudentSchema>;

interface EditStudentModalProps {
  studentToEdit: Student | null; 
}

export default function EditStudentModal({ studentToEdit } : EditStudentModalProps) {
  const { 
    students, 
    closeEditStudentModal, 
    updateStudent, 
    updateStudentGoal,
    loading: dataLoading,
    goalTemplates,
    assignGoalToStudent,
    removeGoalFromStudent,
    currentUser,
  } = useStudentData();
  
  const currentStudent = students.find(s => s.id === studentToEdit?.id) || null;

  const [isSubmittingName, setIsSubmittingName] = useState(false);
  // The goal whose Remove (X) was tapped, waiting for confirmation.
  const [goalToRemove, setGoalToRemove] = useState<string | null>(null);
  // A goal being edited (name, goal text, target, dates, baseline, mastery) in the goal editor, opened over this window.
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  
  const form = useForm<EditStudentFormData>({
    resolver: zodResolver(StudentSchema),
    defaultValues: { name: '' },
  });

  const picker = useTemplatePicker(goalTemplates, currentStudent, currentUser?.uid);



  useEffect(() => {
    if (currentStudent) {
      form.reset({ name: currentStudent.name });
    }
  }, [currentStudent, form]);

  const onSubmitName = async (data: EditStudentFormData) => {
    if (!currentStudent) return;
    setIsSubmittingName(true);
    await updateStudent(currentStudent.id, { name: data.name });
    setIsSubmittingName(false);
    // Toast is handled in updateStudent
  };

  const handleAssignTemplateGoal = (template: GoalTemplate) => {
    if (!currentStudent) return;
    assignGoalToStudent(currentStudent.id, goalFromTemplate(template));
    recordRecentTemplates(currentUser?.uid, [template.id]);
  };
  
  const handleToggleArchiveGoal = async (goal: Goal) => {
    if (currentStudent) {
      await updateStudentGoal(currentStudent.id, goal.id, { isArchived: !goal.isArchived });
    }
  };




  if (!currentStudent) return null; 

  return (
    <GenericModal
      isOpen={!!currentStudent} 
      onClose={closeEditStudentModal}
      title={`Edit Student: ${currentStudent.name}`}
      size="3xl" 
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 [&>*]:min-w-0">
        {/* Column 1: Student Info */}
        <div className="space-y-4">
          {/* Student Information Section */}
          <div>
            <h3 className="text-lg font-medium border-b pb-2 mb-3">Student Information</h3>
            <Form {...form}>
              <form 
                onSubmit={form.handleSubmit(onSubmitName)} 
                onKeyDown={(e) => {
                  if (e.ctrlKey && e.key === 'Enter' && !(e.target as HTMLElement).closest('textarea')) {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit(onSubmitName)();
                  }
                }}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="editStudentName">Student Name</FormLabel>
                      <FormControl>
                        <Input id="editStudentName" placeholder="e.g., Jane Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={isSubmittingName || dataLoading}>
                    {isSubmittingName || dataLoading ? 'Saving Name...' : 'Save Name Changes'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>

        </div>

        {/* Column 2: Manage Assigned Goals (Templates & Current) */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium border-b pb-2 mb-3">Manage Assigned Goals</h3>
          
          <div className="space-y-2">
            <h4 className="text-md font-medium">Current Goals ({currentStudent.goals.length})</h4>
            {currentStudent.goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No goals assigned yet.</p>
            ) : (
              <ScrollArea className="h-60 border rounded-md p-2 [&_[data-radix-scroll-area-viewport]>div]:!block">
                <ul className="space-y-1">
                  {currentStudent.goals.map(goal => (
                    <li key={goal.id} className="flex items-center p-1.5 bg-muted/50 rounded-md text-sm gap-2">
                        <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleToggleArchiveGoal(goal)} title={goal.isArchived ? "Unarchive Goal" : "Archive Goal"}>
                                {goal.isArchived ? <ArchiveRestore className="h-4 w-4 text-green-600" /> : <Archive className="h-4 w-4 text-orange-600" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setEditingGoal(goal)} title="Edit Goal" aria-label={`Edit goal ${goal.name}`}>
                                <Pencil className="h-4 w-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setGoalToRemove(goal.id)} title="Remove Goal Assignment">
                                <XIcon className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                        {goalToRemove === goal.id ? (
                          // Removing hides the goal's recorded sessions from reports; archiving keeps them.
                          <div className="flex-grow min-w-0 space-y-1">
                            <p className="text-xs">Remove <strong>{goal.name}</strong>? Its recorded data will no longer show in reports. Archive keeps it.</p>
                            <div className="flex flex-wrap gap-1">
                              <Button type="button" size="sm" variant="destructive" className="h-7" onClick={() => { setGoalToRemove(null); removeGoalFromStudent(currentStudent.id, goal.id); }}>Remove</Button>
                              {!goal.isArchived && <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => { setGoalToRemove(null); handleToggleArchiveGoal(goal); }}>Archive instead</Button>}
                              <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setGoalToRemove(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                        <div className={cn("flex-grow min-w-0 break-words", goal.isArchived && "opacity-60")}>
                            <GoalTextPopover name={fillNameBlanks(goal)} smartGoal={goalStatement(goal, currentStudent.name)} />
                            <Badge variant="outline" className="ml-1">{goalTypeLabel(goal.dataCaptureType || goal.type)}</Badge>
                            {goal.isArchived && <Badge variant="destructive" className="ml-1">Archived</Badge>}
                        </div>
                        )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-md font-medium">Available Goal Templates to Assign</h4>
            <TemplatePickerFilters picker={picker} />
            <ScrollArea className="h-60 border rounded-md p-2 [&_[data-radix-scroll-area-viewport]>div]:!block">
              {picker.templates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No matching templates found or all assigned.</p>
              ) : (
                <ul className="space-y-1">
                  {picker.templates.slice(0, TEMPLATE_PICKER_LIMIT).map(template => (
                    <li key={template.id} className="flex items-start p-1.5 hover:bg-muted/50 rounded-md text-sm gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 shrink-0" 
                        onClick={() => handleAssignTemplateGoal(template)}
                        title={`Assign ${template.name}`}
                      >
                        <PlusCircleIcon className="h-4 w-4 text-primary" />
                      </Button>
                      <div className="flex-grow min-w-0 break-words">
                        <GoalTextPopover name={template.name} smartGoal={template.generatedSmartGoal} description={template.smartGoalPrompt} />
                        {picker.isRecent(template) && <Badge variant="default" className="ml-2">Recent</Badge>}
                        <Badge variant="secondary" className="ml-2">{template.type}</Badge>
                        {template.category && <Badge variant="outline" className="ml-1">{template.category}</Badge>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {picker.templates.length > TEMPLATE_PICKER_LIMIT && (
                <p className="text-xs text-muted-foreground text-center py-2">Showing {TEMPLATE_PICKER_LIMIT} of {picker.templates.length}. Search or filter to narrow the list.</p>
              )}
            </ScrollArea>
          </div>
        </div>
      </div>
      <div className="pt-4 flex justify-end border-t mt-4">
        <Button type="button" variant="outline" onClick={closeEditStudentModal}>
          Done
        </Button>
      </div>
      {editingGoal && (
        <EditAssignedGoalModal
          isOpen
          onClose={() => setEditingGoal(null)}
          studentId={currentStudent.id}
          goalToEdit={currentStudent.goals.find(g => g.id === editingGoal.id) ?? editingGoal}
        />
      )}
    </GenericModal>
  );
}
