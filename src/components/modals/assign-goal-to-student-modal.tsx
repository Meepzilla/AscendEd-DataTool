
'use client';

import React, { useState } from 'react';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Search, Check, Edit3, TrendingUp } from 'lucide-react';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, Goal, GoalType } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GOAL_TYPES } from '@/lib/goal-constants';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { generateUUID, formatGoalTarget, TEMPLATE_PICKER_LIMIT, goalTypeLabel } from '@/lib/helpers';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';
import { cn } from '@/lib/utils';
import GoalTextPopover from '@/components/forms/GoalTextPopover';
import TemplatePickerFilters from '@/components/goal-templates/TemplatePickerFilters';
import { useTemplatePicker } from '@/hooks/use-template-picker';
import { goalFromTemplate, recordRecentTemplates } from '@/lib/goal-templates';

interface AssignGoalToStudentModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
}

export default function AssignGoalToStudentModal({ student, isOpen, onClose }: AssignGoalToStudentModalProps) {
  const {
    goalTemplates,
    assignGoalToStudent,
    updateStudent,
    students,
    currentUser,
    loading: dataLoading
  } = useStudentData();
  const picker = useTemplatePicker(goalTemplates, student, currentUser?.uid);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const [customGoalName, setCustomGoalName] = useState('');
  const [customGoalType, setCustomGoalType] = useState<GoalType>(Object.values(GOAL_TYPES)[0] as GoalType);
  const [customGoalSmartText, setCustomGoalSmartText] = useState('');
  const [customGoalSessionTarget, setCustomGoalSessionTarget] = useState<number | undefined>(undefined);
  const [isAssigningCustom, setIsAssigningCustom] = useState(false);
  const [isAssigningTemplates, setIsAssigningTemplates] = useState(false);


  const handleToggleTemplateSelection = (templateId: string) => {
    setSelectedTemplates(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(templateId)) {
        newSelection.delete(templateId);
      } else {
        newSelection.add(templateId);
      }
      return newSelection;
    });
  };

  const handleAssignSelectedGoals = async () => {
    if (selectedTemplates.size === 0) return;
    setIsAssigningTemplates(true);

    const goalsToAssign: Goal[] = [];
    selectedTemplates.forEach(templateId => {
      const template = goalTemplates.find(t => t.id === templateId);
      if (template) goalsToAssign.push(goalFromTemplate(template));
    });

    const currentStudentObject = students.find(s => s.id === student.id);

    if (!currentStudentObject) {
      toast({ title: "Error", description: "Student data not found. Cannot assign goals.", variant: "destructive" });
      setIsAssigningTemplates(false);
      return;
    }

    const updatedStudentGoals = [...currentStudentObject.goals, ...goalsToAssign];

    try {
      await updateStudent(student.id, { goals: updatedStudentGoals });

      recordRecentTemplates(currentUser?.uid, [...selectedTemplates]);
      toast({ title: "Success", description: `${goalsToAssign.length} goal(s) assigned from templates.`});
      setSelectedTemplates(new Set());
    } catch (error) {
        console.error("Error assigning multiple goals from templates:", error);
        toast({ title: "Error", description: "Could not assign selected goals from templates.", variant: "destructive"});
    } finally {
        setIsAssigningTemplates(false);
    }
  };

  const handleAssignCustomGoal = async () => {
    if (!customGoalName.trim() || !customGoalSmartText.trim()) {
        toast({ title: "Validation Error", description: "Custom goal name and SMART goal text cannot be empty.", variant: "destructive" });
        return;
    }
    if (customGoalSessionTarget !== undefined && (customGoalSessionTarget < 0 || customGoalSessionTarget > 100)) {
        toast({ title: "Validation Error", description: "Session target percentage must be between 0 and 100 if provided.", variant: "destructive" });
        return;
    }
    setIsAssigningCustom(true);
    const newCustomGoal: Goal = {
      id: generateUUID(),
      name: customGoalName,
      type: customGoalType,
      smartGoal: customGoalSmartText,
      sessionTargetValue: customGoalSessionTarget,
    };

    try {
        await assignGoalToStudent(student.id, newCustomGoal);
        toast({ title: "Success", description: `Custom goal "${newCustomGoal.name}" assigned.`});
        setCustomGoalName('');
        setCustomGoalType(Object.values(GOAL_TYPES)[0] as GoalType);
        setCustomGoalSmartText('');
        setCustomGoalSessionTarget(undefined);
    } catch (error) {
        console.error("Error assigning custom goal:", error);
        toast({ title: "Error", description: "Could not assign custom goal.", variant: "destructive"});
    } finally {
        setIsAssigningCustom(false);
    }
  };


  
  const sortedGoalTypes = React.useMemo(() => Object.values(GOAL_TYPES).sort((a, b) => a.localeCompare(b)), []);


  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Goals to ${student.name}`}
      description="Select from existing templates or create a new custom goal to assign to the student."
      size="2xl" 
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:max-h-[calc(70vh-120px)]"> {/* Adjusted max-h for content area */}
        <div className="space-y-3 flex flex-col">
          <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Assign from Templates
          </h3>
          <TemplatePickerFilters picker={picker} />

          <ScrollArea className="flex-grow border rounded-md p-1.5 h-[200px] [&_[data-radix-scroll-area-viewport]>div]:!block"> {/* Adjusted height and padding */}
            {picker.templates.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                No available templates match criteria or all are assigned.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {picker.templates.slice(0, TEMPLATE_PICKER_LIMIT).map((template) => (
                  <li key={template.id} className="flex items-start gap-1">
                    <Button
                      variant={selectedTemplates.has(template.id) ? "default" : "outline"}
                      className="flex-1 min-w-0 justify-start text-left h-auto py-1.5 px-2 text-sm whitespace-normal"
                      onClick={() => handleToggleTemplateSelection(template.id)}
                      disabled={dataLoading || isAssigningTemplates || isAssigningCustom}
                    >
                      <div className="flex items-center justify-between w-full">
                          <div className="flex-grow min-w-0">
                              <p className="font-medium text-sm break-words">
                                {template.name}
                                {picker.isRecent(template) && <Badge variant="outline" className="ml-2 text-xs">Recent</Badge>}
                              </p>
                              <Badge variant="secondary" className="mt-0.5 text-xs">{template.type}</Badge>
                              {template.category && <Badge variant="outline" className="mt-0.5 ml-1 text-xs">{template.category}</Badge>}
                              {template.sessionTargetValue !== undefined && (
                                <p className="text-xs text-muted-foreground mt-0.5">Target: {formatGoalTarget(template.type, template.sessionTargetValue, template.targetDirection)}</p>
                              )}
                          </div>
                          {selectedTemplates.has(template.id) && <Check className="h-4 w-4 ml-2 text-primary-foreground" />}
                      </div>
                    </Button>
                    <GoalTextPopover iconOnly name={template.name} smartGoal={template.generatedSmartGoal} description={template.smartGoalPrompt} />
                  </li>
                ))}
              </ul>
            )}
            {picker.templates.length > TEMPLATE_PICKER_LIMIT && (
              <p className="text-xs text-muted-foreground text-center py-2">Showing {TEMPLATE_PICKER_LIMIT} of {picker.templates.length}. Search or filter to narrow the list.</p>
            )}
          </ScrollArea>
           <Button
            onClick={handleAssignSelectedGoals}
            disabled={selectedTemplates.size === 0 || dataLoading || isAssigningTemplates || isAssigningCustom}
            className="mt-auto w-full h-9 text-sm"
          >
            {isAssigningTemplates ? 'Assigning...' : `Assign ${selectedTemplates.size} Template(s)`}
            <PlusCircle className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className={cn("my-2", "hidden md:block")} />
        <Separator orientation="horizontal" className={cn("my-3 md:hidden")} />


        <div className="space-y-2 flex flex-col">
          <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-primary" />
            Or Create &amp; Assign Custom Goal
          </h3>
          <div className="space-y-2"> 
            <div>
              <Label htmlFor="customGoalName" className="text-sm">Goal Name</Label>
              <Input
                id="customGoalName"
                value={customGoalName}
                onChange={(e) => setCustomGoalName(e.target.value)}
                placeholder="e.g., Follow 2-step directions"
                disabled={dataLoading || isAssigningTemplates || isAssigningCustom}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="customGoalType" className="text-sm">Goal Type</Label>
              <Select
                value={customGoalType}
                onValueChange={(value) => setCustomGoalType(value as GoalType)}
                disabled={dataLoading || isAssigningTemplates || isAssigningCustom}
              >
                <SelectTrigger id="customGoalType" className="h-9 text-sm">
                  <SelectValue placeholder="Select goal type" />
                </SelectTrigger>
                <SelectContent>
                  {sortedGoalTypes.map(type => (
                    <SelectItem key={type} value={type} className="text-sm">
                      {goalTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="customGoalSmartText" className="text-sm">SMART Goal Text</Label>
              <Textarea
                id="customGoalSmartText"
                value={customGoalSmartText}
                onChange={(e) => setCustomGoalSmartText(e.target.value)}
                placeholder="Enter the full SMART goal description..."
                rows={2} 
                disabled={dataLoading || isAssigningTemplates || isAssigningCustom}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="customGoalSessionTarget" className="text-sm">Session Target Value (Optional)</Label>
               <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <Input
                      id="customGoalSessionTarget"
                      type="number"
                      value={customGoalSessionTarget ?? ''}
                      onChange={(e) => setCustomGoalSessionTarget(e.target.value === '' ? undefined : Number(e.target.value))}
                      placeholder="e.g., 80 (for 80%)"
                      className="flex-grow h-9 text-sm"
                      min="0"
                      max="100"
                      disabled={dataLoading || isAssigningTemplates || isAssigningCustom}
                  />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Target percentage (0-100) for accuracy/fluency goals, a rating for qualitative goals (e.g. 4 out of 5), or the number of different functions for communication functions goals.
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleAssignCustomGoal}
              disabled={!customGoalName.trim() || !customGoalSmartText.trim() || dataLoading || isAssigningTemplates || isAssigningCustom}
              className="h-9 text-sm"
            >
              {isAssigningCustom ? 'Assigning...' : 'Create &amp; Assign Custom Goal'}
              <PlusCircle className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 mt-3 border-t"> {/* Reduced padding */}
        <Button variant="outline" onClick={onClose} disabled={dataLoading || isAssigningTemplates || isAssigningCustom} className="h-9 text-sm">
          Close
        </Button>
      </div>
    </GenericModal>
  );
}
