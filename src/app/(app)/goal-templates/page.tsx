'use client';

import React, { useState, useMemo, Suspense, lazy, useEffect } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import type { GoalTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { PlusCircle, Edit, Trash2, Info, BrainCircuit, Archive, ArchiveRestore, UserPlus, CopyCheck } from 'lucide-react';
import { formatDate, formatGoalTarget, goalTypeLabel } from '@/lib/helpers';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import GoalTemplateFilters, { type GoalTemplateSortOrder, type GridSize } from '@/components/goal-templates/GoalTemplateFilters';

// Lazy load modals
const AddGoalTemplateModal = lazy(() => import('@/components/modals/add-goal-template-modal'));
const EditGoalTemplateModal = lazy(() => import('@/components/modals/edit-goal-template-modal'));
const ConfirmationModal = lazy(() => import('@/components/modals/confirmation-modal'));
const GoalBankDetailsDialog = lazy(() => import('@/components/goal-templates/GoalBankDetailsDialog'));
const AssignTemplateDialog = lazy(() => import('@/components/goal-templates/AssignTemplateDialog'));
const DuplicateFinderDialog = lazy(() => import('@/components/goal-templates/DuplicateFinderDialog'));

// Templates rendered at first and per "Show more": the goal bank has over 1,000.
const PAGE_SIZE = 60;


export default function GoalTemplatesPage() {
  const { 
    goalTemplates, 
    loading, 
    error,
    openAddGoalTemplateModal,
    openEditGoalTemplateModal,
    openDeleteConfirmationModal,
    editingGoalTemplate, 
    deletingStudent,
    updateGoalTemplate,
    closeDeleteConfirmationModal,
  } = useStudentData();
  

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [detailsTemplate, setDetailsTemplate] = useState<GoalTemplate | null>(null);
  const [gridSize, setGridSize] = useState<GridSize>('md');
  const [sortOrder, setSortOrder] = useState<GoalTemplateSortOrder>('date-desc');
  const [showArchived, setShowArchived] = useState(false);
  const [assigningTemplate, setAssigningTemplate] = useState<GoalTemplate | null>(null);
  const [isDuplicateFinderOpen, setIsDuplicateFinderOpen] = useState(false);

  const filteredAndSortedTemplates = useMemo(() => {
    const getSafeTimestamp = (date: Date | string): number => {
        if (date instanceof Date) return date.getTime();
        if (typeof date === 'string') return new Date(date).getTime();
        return 0;
    };

    let templates = [...goalTemplates].filter(template => showArchived || !template.isArchived);

    // Apply type and skill area filters first
    if (filterType !== 'ALL') {
      templates = templates.filter(template => template.type === filterType);
    }
    if (filterCategory !== 'ALL') {
      templates = templates.filter(template => template.category === filterCategory);
    }
    
    // Keyword filter: every word must appear in the name, goal text or skill area.
    if (searchTerm.trim()) {
        const searchWords = searchTerm.toLowerCase().split(' ').filter(word => word);
        templates = templates.filter(template => {
            const templateText = `${template.name} ${template.smartGoalPrompt || ''} ${template.generatedSmartGoal || ''} ${template.category || ''}`.toLowerCase();
            return searchWords.every(word => templateText.includes(word));
        });
    }

    templates.sort((a, b) => {
        switch (sortOrder) {
            case 'date-asc':
                return getSafeTimestamp(a.createdAt) - getSafeTimestamp(b.createdAt);
            case 'name-asc':
                return a.name.localeCompare(b.name);
            case 'name-desc':
                return b.name.localeCompare(a.name);
            case 'date-desc':
            default:
                return getSafeTimestamp(b.createdAt) - getSafeTimestamp(a.createdAt);
        }
    });

    return templates;
  }, [goalTemplates, filterType, filterCategory, searchTerm, sortOrder, showArchived]);

  const categories = useMemo(
    () => Array.from(new Set(goalTemplates.map(t => t.category).filter((c): c is string => !!c))).sort((a, b) => a.localeCompare(b)),
    [goalTemplates]
  );

  // Start again from the top when the list changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filterType, filterCategory, searchTerm, sortOrder, showArchived]);

  const gridClasses = {
    sm: 'grid-cols-1 sm:grid-cols-2',
    md: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    lg: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  };

  
  const handleArchiveToggle = (template: GoalTemplate) => {
    openDeleteConfirmationModal({
      ...template,
      isArchived: !template.isArchived,
    }, 'goalTemplate');
  };

  if (error) {
    return <div className="text-destructive p-4">Error loading goal templates: {error.message}</div>;
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <AddGoalTemplateModal />
        <GoalBankDetailsDialog template={detailsTemplate} onClose={() => setDetailsTemplate(null)} />
        {assigningTemplate && <AssignTemplateDialog template={assigningTemplate} onClose={() => setAssigningTemplate(null)} />}
        {isDuplicateFinderOpen && <DuplicateFinderDialog open onClose={() => setIsDuplicateFinderOpen(false)} />}
        {editingGoalTemplate && <EditGoalTemplateModal templateToEdit={editingGoalTemplate} />}
        {deletingStudent && deletingStudent.type === 'goalTemplate' && (
          <ConfirmationModal
            isOpen={!!deletingStudent}
            onClose={() => closeDeleteConfirmationModal()}
            title={
              (deletingStudent.item as GoalTemplate)?.isArchived !== undefined && (deletingStudent.item as GoalTemplate).isDefault
                ? ((deletingStudent.item as GoalTemplate).isArchived ? `Unarchive Default Template` : `Archive Default Template`)
                : `Delete Template: ${(deletingStudent.item as GoalTemplate)?.name}`
            }
            description={
               (deletingStudent.item as GoalTemplate)?.isArchived !== undefined && (deletingStudent.item as GoalTemplate).isDefault
                ? ((deletingStudent.item as GoalTemplate).isArchived ? "This will make the template visible in the main library again. Are you sure?" : "Archiving a default template will hide it from the main library. You can view and unarchive it later. Are you sure?")
                : "Are you sure you want to permanently delete this custom goal template? This action cannot be undone."
            }
            itemToDelete={(deletingStudent.item as GoalTemplate)?.isDefault ? undefined : (deletingStudent.item as GoalTemplate)}
            itemToUpdate={(deletingStudent.item as GoalTemplate)?.isDefault ? (deletingStudent.item as GoalTemplate) : undefined}
            updateAction={(id, data) => updateGoalTemplate(id, data)}
            confirmText={
               (deletingStudent.item as GoalTemplate)?.isArchived !== undefined && (deletingStudent.item as GoalTemplate).isDefault
                ? ((deletingStudent.item as GoalTemplate).isArchived ? 'Yes, Unarchive' : 'Yes, Archive')
                : 'Yes, Delete'
            }
            deleteActionType="goalTemplate"
          />
        )}
      </Suspense>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2"><BrainCircuit className="h-7 w-7 text-primary"/>Goals</CardTitle>
              <CardDescription>
                Manage your library of reusable goal templates.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setIsDuplicateFinderOpen(true)} size="sm" variant="outline">
                <CopyCheck className="mr-2 h-4 w-4" /> Find Duplicates
              </Button>
              <Button onClick={() => openAddGoalTemplateModal()} size="sm">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Template
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <GoalTemplateFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filterType={filterType}
            setFilterType={setFilterType}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            categories={categories}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            gridSize={gridSize}
            setGridSize={setGridSize}
            showArchived={showArchived}
            setShowArchived={setShowArchived}
          />

          {loading && (
             <div className={cn("grid gap-4", gridClasses[gridSize])}>
                {[1,2,3,4].map(i => <TemplateCardSkeleton key={i} />)}
            </div>
          )}
          
          {!loading && filteredAndSortedTemplates.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <Info className="mx-auto h-12 w-12 mb-4 text-primary" />
              <p>No goal templates found matching your criteria.</p>
            </div>
          )}

          {!loading && filteredAndSortedTemplates.length > 0 && (
            <div className={cn("grid gap-4", gridClasses[gridSize])}>
              {filteredAndSortedTemplates.slice(0, visibleCount).map((template) => {
                return (
                  <Card key={template.id} className={cn("flex flex-col justify-between hover:shadow-md transition-shadow", template.isArchived && "opacity-60 bg-muted/30")}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-semibold leading-tight">{template.name}</CardTitle>
                         <div className="flex items-center gap-1.5">
                          {template.isArchived ? 
                            <Badge variant='outline' className="border-orange-500 text-orange-600">Archived</Badge> 
                            : (template.isDefault && <Badge variant="outline">Default</Badge>)
                          }
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="secondary" className="w-fit">
                          {goalTypeLabel(template.type)}
                        </Badge>
                        {template.category && <Badge variant="outline" className="w-fit">{template.category}</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-2 text-sm">
                      <div>
                          <p className="font-medium text-muted-foreground">SMART Goal Prompt:</p>
                          <p className="text-foreground line-clamp-2" title={template.smartGoalPrompt}>{template.smartGoalPrompt}</p>
                      </div>
                       {template.generatedSmartGoal && (
                          <div>
                              <p className="font-medium text-muted-foreground">SMART Goal:</p>
                              <p className="text-foreground line-clamp-3" title={template.generatedSmartGoal}>{template.generatedSmartGoal}</p>
                          </div>
                      )}
                       {template.sessionTargetValue !== undefined && (
                          <div>
                              <p className="font-medium text-muted-foreground">Session Target:</p>
                              <p className="text-foreground">{formatGoalTarget(template.type, template.sessionTargetValue, template.targetDirection)}</p>
                          </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-between items-center pt-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        Created: {template.createdAt ? formatDate(template.createdAt) : 'N/A'}
                      </p>
                      <div className="flex gap-1">
                        {!template.isArchived && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAssigningTemplate(template)} title="Assign to students">
                            <UserPlus className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        {template.bankId && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailsTemplate(template)} title="Purpose & activity ideas">
                            <Info className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditGoalTemplateModal(template)} title="Edit Template" aria-label="Edit Template">
                          <Edit className="h-4 w-4" />
                        </Button>
                        {template.isDefault ? (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleArchiveToggle(template)} title={template.isArchived ? "Unarchive Template" : "Archive Template"}>
                             {template.isArchived ? <ArchiveRestore className="h-4 w-4 text-green-600"/> : <Archive className="h-4 w-4 text-orange-600"/>}
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDeleteConfirmationModal(template, 'goalTemplate')} title="Delete Template" aria-label="Delete Template">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
          {!loading && filteredAndSortedTemplates.length > visibleCount && (
            <div className="flex flex-col items-center gap-1 pt-4">
              <p className="text-xs text-muted-foreground">Showing {visibleCount} of {filteredAndSortedTemplates.length} templates</p>
              <Button variant="outline" onClick={() => setVisibleCount(c => c + PAGE_SIZE)}>Show More</Button>
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
