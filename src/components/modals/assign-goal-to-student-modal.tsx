
'use client';

import React, { useState } from 'react';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Search, Check, Edit3, TrendingUp } from 'lucide-react';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, Goal, GoalTemplate, GoalType } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GOAL_TYPES } from '@/lib/constants';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { generateUUID } from '@/lib/helpers';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';
// Removed FormDescription import as it's no longer directly used here for the custom part
import { cn } from '@/lib/utils';

interface AssignGoalToStudentModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
}

export default function AssignGoalToStudentModal({ student, isOpen, onClose }: AssignGoalToStudentModalProps) {
  const {
    goalTemplates,
    assignGoalToStudent, // Still used for single custom goal assignment
    updateStudent,       // Used for multiple template assignment
    students,            // Used to get the current student object for multiple assignment
    loading: dataLoading
  } = useStudentData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [goalTypeFilter, setGoalTypeFilter] = useState<string>('ALL');
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
      if (template) {
        goalsToAssign.push({
          id: generateUUID(), // Each assigned goal needs a unique ID
          name: template.name,
          type: template.type,
          smartGoal: template.generatedSmartGoal || `SMART goal for ${template.name}`,
          sessionTargetValue: template.sessionTargetValue,
        });
      }
    });

    // Get the current student object from the context's students array
    const currentStudentObject = students.find(s => s.id === student.id);

    if (!currentStudentObject) {
      toast({ title: "Error", description: "Student data not found. Cannot assign goals.", variant: "destructive" });
      setIsAssigningTemplates(false);
      return;
    }

    // Combine existing goals with new goals
    const updatedStudentGoals = [...currentStudentObject.goals, ...goalsToAssign];

    try {
      // Call updateStudent once with the complete list of goals
      await updateStudent(student.id, { goals: updatedStudentGoals });

      toast({ title: "Success", description: `${goalsToAssign.length} goal(s) assigned from templates.`});
      setSelectedTemplates(new Set()); // Clear selection after successful assignment
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
        // assignGoalToStudent is fine here as it's for a single goal
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

  const filteredGoalTemplates = goalTemplates.filter(template => {
    const nameMatch = template.name.toLowerCase().includes(searchTerm.toLowerCase());
    const typeMatch = goalTypeFilter === 'ALL' || template.type === goalTypeFilter;
    const isAssigned = student.goals.some(g => g.name === template.name && g.type === template.type); // Basic check to hide already assigned by name/type
    return nameMatch && typeMatch && !isAssigned;
  }).sort((a,b) => a.name.localeCompare(b.name));

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Goals to ${student.name}`}
      description="Select from existing templates or create a new custom goal to assign to the student."
      size="xl" 
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-hidden">
        <div className="space-y-3 flex flex-col">
          <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Assign from Templates
          </h3>
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <div className="relative flex-grow w-full sm:w-auto">
              <Input
                placeholder="Search goal templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-8 w-full" 
              />
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <Select value={goalTypeFilter} onValueChange={setGoalTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {Object.values(GOAL_TYPES).map(type => (
                  <SelectItem key={type} value={type}>{type.replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-grow border rounded-md p-2 min-h-[200px]">
            {filteredGoalTemplates.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">
                No available templates match your criteria or all matching templates are already assigned.
              </p>
            ) : (
              <ul className="space-y-2">
                {filteredGoalTemplates.map((template) => (
                  <li key={template.id}>
                    <Button
                      variant={selectedTemplates.has(template.id) ? "default" : "outline"}
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => handleToggleTemplateSelection(template.id)}
                      disabled={dataLoading || isAssigningTemplates || isAssigningCustom}
                    >
                      <div className="flex items-center justify-between w-full">
                          <div className="flex-grow">
                              <p className="font-medium">{template.name}</p>
                              <Badge variant="secondary" className="mt-1">{template.type}</Badge>
                              {template.sessionTargetValue !== undefined && (
                                <p className="text-xs text-muted-foreground mt-0.5">Target: {template.sessionTargetValue}%</p>
                              )}
                          </div>
                          {selectedTemplates.has(template.id) && <Check className="h-5 w-5 ml-2 text-primary-foreground" />}
                      </div>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
           <Button
            onClick={handleAssignSelectedGoals}
            disabled={selectedTemplates.size === 0 || dataLoading || isAssigningTemplates || isAssigningCustom}
            className="mt-auto w-full"
          >
            {isAssigningTemplates ? 'Assigning...' : `Assign ${selectedTemplates.size} Template(s)`}
            <PlusCircle className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className={cn("my-2", "hidden md:block")} />
        <Separator orientation="horizontal" className={cn("my-4 md:hidden")} />


        <div className="space-y-3 flex flex-col">
          <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-primary" />
            Or Create & Assign Custom Goal
          </h3>
          <ScrollArea className="flex-grow pr-0 md:pr-2">
            <div className="space-y-3">
              <div>
                <Label htmlFor="customGoalName">Goal Name</Label>
                <Input
                  id="customGoalName"
                  value={customGoalName}
                  onChange={(e) => setCustomGoalName(e.target.value)}
                  placeholder="e.g., Follow 2-step directions"
                  disabled={dataLoading || isAssigningTemplates || isAssigningCustom}
                />
              </div>
              <div>
                <Label htmlFor="customGoalType">Goal Type</Label>
                <Select
                  value={customGoalType}
                  onValueChange={(value) => setCustomGoalType(value as GoalType)}
                  disabled={dataLoading || isAssigningTemplates || isAssigningCustom}
                >
                  <SelectTrigger id="customGoalType">
                    <SelectValue placeholder="Select goal type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(GOAL_TYPES).map(type => (
                      <SelectItem key={type} value={type}>{type.replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="customGoalSmartText">SMART Goal Text</Label>
                <Textarea
                  id="customGoalSmartText"
                  value={customGoalSmartText}
                  onChange={(e) => setCustomGoalSmartText(e.target.value)}
                  placeholder="Enter the full SMART goal description..."
                  rows={3}
                  disabled={dataLoading || isAssigningTemplates || isAssigningCustom}
                />
              </div>
              <div>
                <Label htmlFor="customGoalSessionTarget">Session Target Value (Optional)</Label>
                 <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    <Input
                        id="customGoalSessionTarget"
                        type="number"
                        value={customGoalSessionTarget ?? ''}
                        onChange={(e) => setCustomGoalSessionTarget(e.target.value === '' ? undefined : Number(e.target.value))}
                        placeholder="e.g., 80 (for 80%)"
                        className="flex-grow"
                        min="0"
                        max="100"
                        disabled={dataLoading || isAssigningTemplates || isAssigningCustom}
                    />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Target percentage (0-100) for accuracy/fluency, or a specific rating for qualitative goals.
                </p>
              </div>
            </div>
          </ScrollArea>
          <Button
            onClick={handleAssignCustomGoal}
            disabled={!customGoalName.trim() || !customGoalSmartText.trim() || dataLoading || isAssigningTemplates || isAssigningCustom}
            className="mt-auto w-full"
          >
            {isAssigningCustom ? 'Assigning...' : 'Create & Assign Custom Goal'}
            <PlusCircle className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-6 mt-4 border-t">
        <Button variant="outline" onClick={onClose} disabled={dataLoading || isAssigningTemplates || isAssigningCustom}>
          Close
        </Button>
      </div>
    </GenericModal>
  );
}

