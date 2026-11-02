
'use client';

import React, { useState } from 'react';
import GenericModal from './generic-modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CustomGoalForm from '@/components/goal-templates/CustomGoalForm';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Search, Check, Edit3 } from 'lucide-react';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, Goal } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { formatGoalTarget, goalTypeLabel, TEMPLATE_PICKER_LIMIT } from '@/lib/helpers';
import { useToast } from '@/hooks/use-toast';
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
    updateStudent,
    students,
    currentUser,
    loading: dataLoading
  } = useStudentData();
  const picker = useTemplatePicker(goalTemplates, student, currentUser?.uid);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const { toast } = useToast();

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

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Goals to ${student.name}`}
      description="Select from existing templates or create a new custom goal to assign to the student."
      size="2xl" 
    >
      <Tabs defaultValue="templates">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates"><Search className="mr-2 h-4 w-4" aria-hidden />From templates</TabsTrigger>
          <TabsTrigger value="custom"><Edit3 className="mr-2 h-4 w-4" aria-hidden />Write a custom goal</TabsTrigger>
        </TabsList>
        <TabsContent value="templates" className="mt-3">
        <div className="space-y-3 flex flex-col">
          <p className="text-xs text-muted-foreground">
            Search by skill or sound (such as &quot;/s/&quot;, &quot;wh- questions&quot; or &quot;AAC&quot;) or filter by goal type and skill area,
            then tick goals and assign them. Can&apos;t find it? Use <span className="font-medium">Write a custom goal</span>.
          </p>
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
                      disabled={dataLoading || isAssigningTemplates}
                    >
                      <div className="flex items-center justify-between w-full">
                          <div className="flex-grow min-w-0">
                              <p className="font-medium text-sm break-words">
                                {template.name}
                                {picker.isRecent(template) && <Badge variant="outline" className="ml-2 text-xs">Recent</Badge>}
                              </p>
                              <Badge variant="secondary" className="mt-0.5 text-xs">{goalTypeLabel(template.type)}</Badge>
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
            disabled={selectedTemplates.size === 0 || dataLoading || isAssigningTemplates}
            className="mt-auto w-full h-9 text-sm"
          >
            {isAssigningTemplates ? 'Assigning...' : `Assign ${selectedTemplates.size} Template(s)`}
            <PlusCircle className="ml-2 h-4 w-4" />
          </Button>
        </div>
        </TabsContent>

        <TabsContent value="custom" className="mt-3">
          <CustomGoalForm student={student} disabled={dataLoading || isAssigningTemplates} />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-3 mt-3 border-t"> {/* Reduced padding */}
        <Button variant="outline" onClick={onClose} disabled={dataLoading || isAssigningTemplates} className="h-9 text-sm">
          Close
        </Button>
      </div>
    </GenericModal>
  );
}
