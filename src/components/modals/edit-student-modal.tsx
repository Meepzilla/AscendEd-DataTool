
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, Goal, GoalTemplate, GoalType } from '@/lib/types';
import { StudentSchema } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { XIcon, PlusCircleIcon, SearchIcon, Sparkles, Loader2, Archive, ArchiveRestore } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GOAL_TYPES, GOAL_TYPE_FIELDS } from '@/lib/goal-constants';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { generateUUID, templateMatchesSearch, TEMPLATE_PICKER_LIMIT, goalTypeLabel } from '@/lib/helpers';
import { generateSmartGoal } from '@/ai/flows/smart-goal-generation';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { useErrorLog } from '@/hooks/use-error-log';
import { cn } from '@/lib/utils';
import { AI_ENABLED } from '@/lib/features';

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
  } = useStudentData();
  const { toast } = useToast();
  const { addErrorLog } = useErrorLog();
  
  const currentStudent = students.find(s => s.id === studentToEdit?.id) || null;

  const [isSubmittingName, setIsSubmittingName] = useState(false);
  
  const form = useForm<EditStudentFormData>({
    resolver: zodResolver(StudentSchema),
    defaultValues: { name: '' },
  });

  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [templateGoalTypeFilter, setTemplateGoalTypeFilter] = useState<string>('ALL');

  // State for AI Goal Generation
  const [aiGoalName, setAiGoalName] = useState('');
  const [aiGoalType, setAiGoalType] = useState<GoalType>(Object.values(GOAL_TYPES)[0] as GoalType);
  const [aiDataCaptureType, setAiDataCaptureType] = useState<GoalType>(Object.keys(GOAL_TYPE_FIELDS)[0] as GoalType);
  const [aiGoalPrompt, setAiGoalPrompt] = useState('');
  const [aiGeneratedSmartGoal, setAiGeneratedSmartGoal] = useState('');
  const [aiGoalSessionTarget, setAiGoalSessionTarget] = useState<number | undefined>(undefined);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isAssigningAiGoal, setIsAssigningAiGoal] = useState(false);
  
  const sortedDataCaptureTypes = React.useMemo(() => Object.keys(GOAL_TYPE_FIELDS).sort((a, b) => a.localeCompare(b)), []);


  useEffect(() => {
    if (currentStudent) {
      form.reset({ name: currentStudent.name });
      // Reset AI form fields when modal opens or student changes
      setAiGoalName('');
      setAiGoalType(Object.values(GOAL_TYPES)[0] as GoalType);
      setAiDataCaptureType(Object.keys(GOAL_TYPE_FIELDS)[0] as GoalType);
      setAiGoalPrompt('');
      setAiGeneratedSmartGoal('');
      setAiGoalSessionTarget(undefined);
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
    const newGoal: Goal = {
      id: generateUUID(), 
      name: template.name,
      type: template.type,
      dataCaptureType: template.dataCaptureType,
      smartGoal: template.generatedSmartGoal || `SMART goal for ${template.name}`, 
      sessionTargetValue: template.sessionTargetValue,
      targetDirection: template.targetDirection,
    };
    assignGoalToStudent(currentStudent.id, newGoal);
  };
  
  const handleToggleArchiveGoal = async (goal: Goal) => {
    if (currentStudent) {
      await updateStudentGoal(currentStudent.id, goal.id, { isArchived: !goal.isArchived });
    }
  };

  const filteredGoalTemplates = goalTemplates.filter(template => {
    const nameMatch = templateMatchesSearch(template, templateSearchTerm);
    const typeMatch = templateGoalTypeFilter === 'ALL' || template.type === templateGoalTypeFilter;
    // Check if this template (by name and type) is already effectively assigned to the student
    const alreadyAssigned = currentStudent?.goals.some(g => g.name === template.name && g.type === template.type);
    return nameMatch && typeMatch && !alreadyAssigned;
  }).sort((a,b) => a.name.localeCompare(b.name));


  const isGoalEffectivelyAssigned = (template: GoalTemplate): boolean => {
    if (!currentStudent) return false;
    // This check is by name and type, which is how we define if a template-derived goal is "taken"
    return currentStudent.goals.some(g => g.name === template.name && g.type === template.type);
  };

  const handleGenerateAiSmartGoal = async () => {
    if (!aiGoalPrompt.trim()) {
      toast({ title: "Info", description: "AI prompt cannot be empty.", variant: "default" });
      return;
    }
    setIsAiGenerating(true);
    setAiGeneratedSmartGoal('');
    try {
      const result = await generateSmartGoal({ goalPrompt: aiGoalPrompt });
      if (result.smartGoal) {
        setAiGeneratedSmartGoal(result.smartGoal);
        toast({ title: "AI Success", description: "SMART goal text generated!" });
      } else {
        toast({ title: "AI Info", description: "AI did not return a goal. Try refining your prompt.", variant: "default" });
      }
    } catch (error: any) {
      console.error("Error generating SMART goal via AI:", error);
      addErrorLog({ message: 'Failed to generate SMART goal with AI in EditStudentModal.', source: 'EditStudentModal.handleGenerateAiSmartGoal', details: error.message, type: 'error' });
      toast({ title: "AI Error", description: "Failed to generate SMART goal text.", variant: "destructive" });
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleAssignAiGeneratedGoal = async () => {
    if (!currentStudent || !aiGoalName.trim() || !aiGeneratedSmartGoal.trim()) {
      toast({ title: "Validation Error", description: "Goal name and generated SMART goal text are required.", variant: "destructive" });
      return;
    }
    if (aiGoalSessionTarget !== undefined && (aiGoalSessionTarget < 0 || aiGoalSessionTarget > 100)) {
        toast({ title: "Validation Error", description: "Session target percentage must be between 0 and 100 if provided.", variant: "destructive" });
        return;
    }
    setIsAssigningAiGoal(true);
    const newGoal: Goal = {
      id: generateUUID(),
      name: aiGoalName,
      type: aiGoalType,
      dataCaptureType: aiDataCaptureType,
      smartGoal: aiGeneratedSmartGoal,
      sessionTargetValue: aiGoalSessionTarget,
    };
    try {
      await assignGoalToStudent(currentStudent.id, newGoal);
      toast({ title: "Success", description: `AI Generated Goal "${aiGoalName}" assigned.` });
      // Reset AI form fields after successful assignment
      setAiGoalName('');
      setAiGoalType(Object.values(GOAL_TYPES)[0] as GoalType);
      setAiDataCaptureType(Object.keys(GOAL_TYPE_FIELDS)[0] as GoalType);
      setAiGoalPrompt('');
      setAiGeneratedSmartGoal('');
      setAiGoalSessionTarget(undefined);
    } catch (error) {
        console.error("Error assigning AI generated goal:", error);
        toast({ title: "Error", description: "Could not assign AI generated goal.", variant: "destructive"});
    } finally {
      setIsAssigningAiGoal(false);
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
        {/* Column 1: Student Info & AI Goal Creation */}
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

          {AI_ENABLED && (
            <>
              <Separator className="my-6" />

              {/* Create & Assign New Goal with AI Section */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium border-b pb-2 mb-3 text-primary">Create & Assign New Goal with AI</h3>
                <div>
                  <Label htmlFor="aiGoalName" className="text-sm">New Goal Name / Topic</Label>
                  <Input
                    id="aiGoalName"
                    value={aiGoalName}
                    onChange={(e) => setAiGoalName(e.target.value)}
                    placeholder="e.g., Articulate /k/ in sentences"
                    disabled={dataLoading || isAiGenerating || isAssigningAiGoal}
                    className="h-9"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="aiGoalTypeSelect" className="text-sm">Clinical Category</Label>
                    <Select
                      value={aiGoalType}
                      onValueChange={(value) => setAiGoalType(value as GoalType)}
                      disabled={dataLoading || isAiGenerating || isAssigningAiGoal}
                    >
                      <SelectTrigger id="aiGoalTypeSelect" className="h-9">
                        <SelectValue placeholder="Select goal type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(GOAL_TYPES).map(type => (
                          <SelectItem key={type} value={type}>
                            {goalTypeLabel(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                   <div>
                    <Label htmlFor="aiDataCaptureTypeSelect" className="text-sm">Data Capture Method</Label>
                    <Select
                      value={aiDataCaptureType}
                      onValueChange={(value) => setAiDataCaptureType(value as GoalType)}
                      disabled={dataLoading || isAiGenerating || isAssigningAiGoal}
                    >
                      <SelectTrigger id="aiDataCaptureTypeSelect" className="h-9">
                        <SelectValue placeholder="Select capture method" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedDataCaptureTypes.map(type => (
                          <SelectItem key={type} value={type}>
                            {goalTypeLabel(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="aiGoalPromptText" className="text-sm">Brief Description/Prompt for AI</Label>
                  <Textarea
                    id="aiGoalPromptText"
                    value={aiGoalPrompt}
                    onChange={(e) => setAiGoalPrompt(e.target.value)}
                    placeholder="E.g., Student will correctly use past tense -ed verbs in spontaneous sentences."
                    rows={2}
                    disabled={dataLoading || isAiGenerating || isAssigningAiGoal}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateAiSmartGoal}
                  disabled={isAiGenerating || !aiGoalPrompt.trim() || dataLoading || isAssigningAiGoal}
                  className="w-full sm:w-auto h-9"
                >
                  {isAiGenerating ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Generate SMART Goal Text
                </Button>
                {aiGeneratedSmartGoal && (
                  <div>
                    <Label htmlFor="aiGeneratedSmartGoalText" className="text-sm">Generated SMART Goal (Editable)</Label>
                    <Textarea
                      id="aiGeneratedSmartGoalText"
                      value={aiGeneratedSmartGoal}
                      onChange={(e) => setAiGeneratedSmartGoal(e.target.value)}
                      rows={3}
                      className="bg-muted/40"
                      disabled={dataLoading || isAiGenerating || isAssigningAiGoal}
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="aiGoalSessionTargetInput" className="text-sm">Session Target (Optional %)</Label>
                  <Input
                    id="aiGoalSessionTargetInput"
                    type="number"
                    value={aiGoalSessionTarget ?? ''}
                    onChange={(e) => setAiGoalSessionTarget(e.target.value === '' ? undefined : Number(e.target.value))}
                    placeholder="e.g., 80"
                    min="0" max="100"
                    disabled={dataLoading || isAiGenerating || isAssigningAiGoal}
                    className="h-9"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleAssignAiGeneratedGoal}
                  disabled={!aiGoalName.trim() || !aiGeneratedSmartGoal.trim() || dataLoading || isAiGenerating || isAssigningAiGoal}
                  className="w-full sm:w-auto h-9"
                >
                  {isAssigningAiGoal ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <PlusCircleIcon className="h-4 w-4 mr-2" />}
                  Assign AI Generated Goal
                </Button>
              </div>
            </>
          )}
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
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeGoalFromStudent(currentStudent.id, goal.id)} title="Remove Goal Assignment">
                                <XIcon className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                        <div className={cn("flex-grow min-w-0 break-words", goal.isArchived && "opacity-60")}>
                            <span>{goal.name}</span>
                            <Badge variant="outline" className="ml-1">{goal.type}</Badge>
                            {goal.isArchived && <Badge variant="destructive" className="ml-1">Archived</Badge>}
                        </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-md font-medium">Available Goal Templates to Assign</h4>
            <div className="flex gap-2 items-center">
              <div className="relative flex-grow">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search templates..." 
                  value={templateSearchTerm} 
                  onChange={(e) => setTemplateSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={templateGoalTypeFilter} onValueChange={setTemplateGoalTypeFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  {Object.values(GOAL_TYPES).map(type => (
                    <SelectItem key={type} value={type}>
                      {goalTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ScrollArea className="h-60 border rounded-md p-2 [&_[data-radix-scroll-area-viewport]>div]:!block">
              {filteredGoalTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No matching templates found or all assigned.</p>
              ) : (
                <ul className="space-y-1">
                  {filteredGoalTemplates.slice(0, TEMPLATE_PICKER_LIMIT).map(template => (
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
                        <span>{template.name}</span>
                        <Badge variant="secondary" className="ml-2">{template.type}</Badge>
                        {template.category && <Badge variant="outline" className="ml-1">{template.category}</Badge>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {filteredGoalTemplates.length > TEMPLATE_PICKER_LIMIT && (
                <p className="text-xs text-muted-foreground text-center py-2">Showing {TEMPLATE_PICKER_LIMIT} of {filteredGoalTemplates.length}. Search or filter to narrow the list.</p>
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
    </GenericModal>
  );
}
