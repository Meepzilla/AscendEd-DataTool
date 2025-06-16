
'use client';

import React, { useState } from 'react';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Search, Check, Edit3 } from 'lucide-react';
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

interface AssignGoalToStudentModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
}

export default function AssignGoalToStudentModal({ student, isOpen, onClose }: AssignGoalToStudentModalProps) {
  const { goalTemplates, assignGoalToStudent, loading: dataLoading } = useStudentData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [goalTypeFilter, setGoalTypeFilter] = useState<string>('ALL');
  const { toast } = useToast();

  // State for custom goal creation
  const [customGoalName, setCustomGoalName] = useState('');
  const [customGoalType, setCustomGoalType] = useState<GoalType>(Object.values(GOAL_TYPES)[0] as GoalType);
  const [customGoalSmartText, setCustomGoalSmartText] = useState('');
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
          id: generateUUID(), 
          name: template.name,
          type: template.type,
          smartGoal: template.generatedSmartGoal || `SMART goal for ${template.name}`,
        });
      }
    });

    try {
      await Promise.all(goalsToAssign.map(goal => assignGoalToStudent(student.id, goal)));
      toast({ title: "Success", description: `${goalsToAssign.length} goal(s) assigned from templates.`});
      setSelectedTemplates(new Set()); 
      // onClose(); // Optionally close, or allow assigning more
    } catch (error) {
        console.error("Error assigning goals from templates:", error);
        toast({ title: "Error", description: "Could not assign goals from templates.", variant: "destructive"});
    } finally {
        setIsAssigningTemplates(false);
    }
  };

  const handleAssignCustomGoal = async () => {
    if (!customGoalName.trim() || !customGoalSmartText.trim()) {
        toast({ title: "Validation Error", description: "Custom goal name and SMART goal text cannot be empty.", variant: "destructive" });
        return;
    }
    setIsAssigningCustom(true);
    const newCustomGoal: Goal = {
      id: generateUUID(),
      name: customGoalName,
      type: customGoalType,
      smartGoal: customGoalSmartText,
    };

    try {
        await assignGoalToStudent(student.id, newCustomGoal);
        toast({ title: "Success", description: `Custom goal "${newCustomGoal.name}" assigned.`});
        // Reset custom goal fields
        setCustomGoalName('');
        setCustomGoalType(Object.values(GOAL_TYPES)[0] as GoalType);
        setCustomGoalSmartText('');
        // onClose(); // Optionally close
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
    const isAssigned = student.goals.some(g => g.name === template.name && g.type === template.type);
    return nameMatch && typeMatch && !isAssigned;
  }).sort((a,b) => a.name.localeCompare(b.name));

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Goals to ${student.name}`}
      description="Select from existing templates or create a new custom goal to assign to the student."
      size="xl" // Increased size to accommodate custom goal form
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-hidden">
        {/* Templates Section */}
        <div className="space-y-3 flex flex-col">
          <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Assign from Templates
          </h3>
          <div className="flex gap-2 items-center">
            <div className="relative flex-grow">
              <Input
                placeholder="Search goal templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-8" // Make space for clear button if added
              />
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <Select value={goalTypeFilter} onValueChange={setGoalTypeFilter}>
              <SelectTrigger className="w-[180px]">
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
            className="mt-auto"
          >
            {isAssigningTemplates ? 'Assigning...' : `Assign ${selectedTemplates.size} Template(s)`}
            <PlusCircle className="ml-2 h-4 w-4" />
          </Button>
        </div>
        
        <Separator orientation="vertical" className="hidden md:block h-auto my-2" />
        
        {/* Custom Goal Section */}
        <div className="space-y-3 flex flex-col">
          <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-primary" />
            Or Create & Assign Custom Goal
          </h3>
          <div className="space-y-3 flex-grow">
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
                rows={4}
                disabled={dataLoading || isAssigningTemplates || isAssigningCustom}
              />
            </div>
          </div>
          <Button 
            onClick={handleAssignCustomGoal} 
            disabled={!customGoalName.trim() || !customGoalSmartText.trim() || dataLoading || isAssigningTemplates || isAssigningCustom}
            className="mt-auto"
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

        