
'use client';

import React, { useState, useMemo, Suspense, lazy } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import type { GoalTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { PlusCircle, Edit, Trash2, Search, ListFilter, Sparkles, Info, ListPlus, Grid } from 'lucide-react';
import { formatDate } from '@/lib/helpers';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GOAL_TYPES } from '@/lib/goal-constants';
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';

// Lazy load modals
const AddGoalTemplateModal = lazy(() => import('@/components/modals/add-goal-template-modal'));
const EditGoalTemplateModal = lazy(() => import('@/components/modals/edit-goal-template-modal'));
const ConfirmationModal = lazy(() => import('@/components/modals/confirmation-modal'));


export default function GoalTemplatesPage() {
  const { 
    goalTemplates, 
    loading, 
    error, // This error is now for actual Firebase errors
    isFirebaseDBAvailable, // Use this to check for local mode
    openAddGoalTemplateModal,
    openEditGoalTemplateModal,
    openDeleteGoalTemplateModal,
    editingGoalTemplate, 
    deletingGoalTemplate, 
  } = useStudentData();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [gridSize, setGridSize] = useState<'sm' | 'md' | 'lg'>('md');

  const filteredTemplates = useMemo(() => {
    const getSafeTimestamp = (date: Date | Timestamp | string): number => {
        if (date instanceof Date) return date.getTime();
        if (typeof date === 'string') return new Date(date).getTime();
        if (date && typeof (date as Timestamp).toDate === 'function') return (date as Timestamp).toDate().getTime();
        return 0;
    };

    const searchWords = searchTerm.toLowerCase().split(' ').filter(word => word);

    return goalTemplates
      .filter(template => {
        const typeMatch = filterType === 'ALL' || template.type === filterType;
        if (!typeMatch) return false;

        if (searchWords.length === 0) return true;

        const templateText = `${template.name.toLowerCase()} ${template.smartGoalPrompt?.toLowerCase() || ''}`;
        return searchWords.every(word => templateText.includes(word));
      })
      .map(template => {
        let score = 0;
        if (searchWords.length > 0) {
          const templateName = template.name.toLowerCase();
          const templatePrompt = template.smartGoalPrompt?.toLowerCase() || '';
          
          searchWords.forEach(word => {
            if (templateName.includes(word)) score += 2; // Higher score for name match
            if (templatePrompt.includes(word)) score += 1;
          });
        }
        return { ...template, score };
      })
      .sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score; // Higher score first
        }
        const dateA = getSafeTimestamp(a.createdAt);
        const dateB = getSafeTimestamp(b.createdAt);
        return dateB - dateA; // Then by most recent
      });
  }, [goalTemplates, searchTerm, filterType]);

  const gridClasses = {
    sm: 'grid-cols-1 sm:grid-cols-2',
    md: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    lg: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  };


  if (error) { // This will now only show for actual Firebase data loading errors
    return <div className="text-destructive p-4">Error loading goal templates from Firebase: {error.message}</div>;
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <AddGoalTemplateModal />
        {editingGoalTemplate && <EditGoalTemplateModal templateToEdit={editingGoalTemplate} />}
        {deletingGoalTemplate && (
          <ConfirmationModal
            isOpen={!!deletingGoalTemplate}
            onClose={() => openDeleteGoalTemplateModal(null)}
            onConfirm={() => { /* Context handles delete */ }}
            title={`Delete Template: ${deletingGoalTemplate.name}`}
            description="Are you sure you want to delete this goal template? This action cannot be undone."
            itemToDelete={deletingGoalTemplate}
            deleteActionType="goalTemplate"
          />
        )}
      </Suspense>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2"><ListPlus className="h-7 w-7 text-primary"/>Goals</CardTitle>
              <CardDescription>
                Manage your library of reusable goal templates. 
                {!isFirebaseDBAvailable && !loading && <span className="text-orange-500 font-semibold">(Local Mode: Data not saved to cloud)</span>}
              </CardDescription>
            </div>
            <Button onClick={openAddGoalTemplateModal} size="sm">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                type="search"
                placeholder="Search templates by name or prompt..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full"
                />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-[180px]">
                    <ListFilter className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    {Object.values(GOAL_TYPES).map(type => (
                        <SelectItem key={type} value={type}>{type.replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={gridSize} onValueChange={(value) => setGridSize(value as 'sm' | 'md' | 'lg')}>
                <SelectTrigger className="w-full sm:w-[130px]">
                    <Grid className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Grid Size" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="sm">Small</SelectItem>
                    <SelectItem value="md">Medium</SelectItem>
                    <SelectItem value="lg">Large</SelectItem>
                </SelectContent>
            </Select>
          </div>

          {loading && (
             <div className={cn("grid gap-4", gridClasses[gridSize])}>
                {[1,2,3,4].map(i => <TemplateCardSkeleton key={i} />)}
            </div>
          )}
          
          {!loading && filteredTemplates.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <Info className="mx-auto h-12 w-12 mb-4 text-primary" />
              <p>No goal templates found matching your criteria.</p>
              <p>Try adjusting your search or filters, or add a new template.</p>
            </div>
          )}

          {!loading && filteredTemplates.length > 0 && (
            <div className={cn("grid gap-4", gridClasses[gridSize])}>
              {filteredTemplates.map((template) => (
                <Card key={template.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg font-semibold leading-tight">{template.name}</CardTitle>
                      {template.isDefault && <Badge variant="outline">Default</Badge>}
                    </div>
                    <Badge variant="secondary" className="mt-1 w-fit">{template.type.replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</Badge>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-2 text-sm">
                    <div>
                        <p className="font-medium text-muted-foreground">SMART Goal Prompt:</p>
                        <p className="text-foreground line-clamp-2" title={template.smartGoalPrompt}>{template.smartGoalPrompt}</p>
                    </div>
                     {template.generatedSmartGoal && (
                        <div>
                            <p className="font-medium text-muted-foreground flex items-center gap-1"><Sparkles className="h-4 w-4 text-yellow-500" />Generated SMART Goal:</p>
                            <p className="text-foreground line-clamp-3" title={template.generatedSmartGoal}>{template.generatedSmartGoal}</p>
                        </div>
                    )}
                     {template.sessionTargetValue !== undefined && (
                        <div>
                            <p className="font-medium text-muted-foreground">Session Target:</p>
                            <p className="text-foreground">{template.sessionTargetValue}{template.type.startsWith('QUALITATIVE') ? '' : '%'}</p>
                        </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex justify-between items-center pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Created: {template.createdAt ? formatDate(template.createdAt) : 'N/A'}
                    </p>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditGoalTemplateModal(template)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!template.isDefault && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDeleteGoalTemplateModal(template)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
  );
}


function TemplateCardSkeleton() {
    return (
        <Card className="flex flex-col justify-between">
            <CardHeader className="pb-3">
                <Skeleton className="h-6 w-3/4 mb-1" />
                <Skeleton className="h-4 w-1/3" />
            </CardHeader>
            <CardContent className="flex-grow space-y-3 text-sm">
                <div>
                    <Skeleton className="h-4 w-1/2 mb-1" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6 mt-1" />
                </div>
                 <div>
                    <Skeleton className="h-4 w-1/2 mb-1" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6 mt-1" />
                    <Skeleton className="h-3 w-4/6 mt-1" />
                </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center pt-3 border-t">
                <Skeleton className="h-4 w-1/4" />
                <div className="flex gap-1">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                </div>
            </CardFooter>
        </Card>
    );
}



    