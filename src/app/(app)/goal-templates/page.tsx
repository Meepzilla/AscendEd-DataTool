'use client';

import React, { useState, useMemo, Suspense, lazy, useCallback, useEffect } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import type { GoalTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { PlusCircle, Edit, Trash2, Sparkles, Info, Loader2, BrainCircuit, Archive, ArchiveRestore } from 'lucide-react';
import { formatDate } from '@/lib/helpers';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { findRelevantGoals, type FindRelevantGoalsOutput } from '@/ai/flows/semantic-search-flow';
import { useToast } from '@/hooks/use-toast';
import { useErrorLog } from '@/hooks/use-error-log';
import GoalTemplateFilters, { type GoalTemplateSortOrder, type GridSize } from '@/components/goal-templates/GoalTemplateFilters';
import { AI_ENABLED } from '@/lib/features';

// Lazy load modals
const AddGoalTemplateModal = lazy(() => import('@/components/modals/add-goal-template-modal'));
const EditGoalTemplateModal = lazy(() => import('@/components/modals/edit-goal-template-modal'));
const ConfirmationModal = lazy(() => import('@/components/modals/confirmation-modal'));


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
  
  const { toast } = useToast();
  const { addErrorLog } = useErrorLog();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [gridSize, setGridSize] = useState<GridSize>('md');
  const [sortOrder, setSortOrder] = useState<GoalTemplateSortOrder>('date-desc');
  const [isAiSearchEnabled, setIsAiSearchEnabled] = useState(AI_ENABLED);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [rankedGoals, setRankedGoals] = useState<FindRelevantGoalsOutput['rankedGoals'] | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const handleSemanticSearch = useCallback(async () => {
    if (!searchTerm.trim() || goalTemplates.length === 0) {
      setRankedGoals(null);
      return;
    }
    
    setIsAiSearching(true);
    setSortOrder('relevance'); // Default to relevance sort on AI search
    try {
      const templatesForSearch = goalTemplates.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        smartGoalPrompt: t.smartGoalPrompt || '',
      }));

      const result = await findRelevantGoals({
        query: searchTerm,
        goals: templatesForSearch,
      });

      setRankedGoals(result.rankedGoals);
      toast({ title: 'Search Complete', description: `AI has ranked ${result.rankedGoals.length} relevant goals.` });
    } catch (err: any) {
      console.error("Semantic search failed:", err);
      addErrorLog({ message: 'Semantic search AI flow failed.', source: 'GoalTemplatesPage.handleSemanticSearch', details: err.message, type: 'error' });
      toast({ title: 'AI Search Error', description: 'Could not perform semantic search.', variant: 'destructive' });
      setRankedGoals(null); // Fallback to normal filtering on error
    } finally {
      setIsAiSearching(false);
    }
  }, [searchTerm, goalTemplates, toast, addErrorLog]);

  useEffect(() => {
    if (!isAiSearchEnabled) {
      setRankedGoals(null);
      if (sortOrder === 'relevance') {
        setSortOrder('date-desc');
      }
    } else {
        // When AI search is re-enabled, clear the simple search term to avoid confusion
        setRankedGoals(null);
    }
  }, [isAiSearchEnabled, sortOrder]);


  const filteredAndSortedTemplates = useMemo(() => {
    const getSafeTimestamp = (date: Date | string): number => {
        if (date instanceof Date) return date.getTime();
        if (typeof date === 'string') return new Date(date).getTime();
        return 0;
    };

    let templates = [...goalTemplates].filter(template => showArchived || !template.isArchived);

    // Apply type filter first
    if (filterType !== 'ALL') {
      templates = templates.filter(template => template.type === filterType);
    }
    
    if (isAiSearchEnabled) {
        // AI Search logic (uses rankedGoals)
        if (rankedGoals) {
            templates = templates.filter(t => rankedGoals.some(rg => rg.id === t.id));
        } else if (searchTerm.trim() !== '') {
            // Before AI search is run, don't show any results to avoid confusion
            templates = [];
        }
    } else {
        // Simple keyword filter logic
        if (searchTerm.trim()) {
            const searchWords = searchTerm.toLowerCase().split(' ').filter(word => word);
            templates = templates.filter(template => {
                const templateText = `${template.name.toLowerCase()} ${template.smartGoalPrompt?.toLowerCase() || ''}`;
                return searchWords.every(word => templateText.includes(word));
            });
        }
    }

    // Apply sorting
    const rankedMap = rankedGoals ? new Map(rankedGoals.map((g, index) => [g.id, { rank: index, score: g.relevanceScore }])) : null;

    templates.sort((a, b) => {
        switch (sortOrder) {
            case 'relevance':
                if (rankedMap) {
                    const rankA = rankedMap.get(a.id)?.rank ?? Infinity;
                    const rankB = rankedMap.get(b.id)?.rank ?? Infinity;
                    return rankA - rankB;
                }
                return 0; // Fallback if no ranks
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
  }, [goalTemplates, filterType, rankedGoals, searchTerm, sortOrder, isAiSearchEnabled, showArchived]);

  const gridClasses = {
    sm: 'grid-cols-1 sm:grid-cols-2',
    md: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    lg: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  };

  const relevanceScoreMap = useMemo(() => {
    if (!rankedGoals) return new Map();
    return new Map(rankedGoals.map(g => [g.id, g.relevanceScore]));
  }, [rankedGoals]);
  
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
            <Button onClick={() => openAddGoalTemplateModal()} size="sm">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <GoalTemplateFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filterType={filterType}
            setFilterType={setFilterType}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            gridSize={gridSize}
            setGridSize={setGridSize}
            isAiSearchEnabled={isAiSearchEnabled}
            setIsAiSearchEnabled={setIsAiSearchEnabled}
            isAiSearching={isAiSearching}
            onSemanticSearch={handleSemanticSearch}
            onClearAiSearch={() => setRankedGoals(null)}
            showArchived={showArchived}
            setShowArchived={setShowArchived}
          />

          {(loading || isAiSearching) && (
             <div className={cn("grid gap-4", gridClasses[gridSize])}>
                {[1,2,3,4].map(i => <TemplateCardSkeleton key={i} />)}
            </div>
          )}
          
          {!loading && !isAiSearching && filteredAndSortedTemplates.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <Info className="mx-auto h-12 w-12 mb-4 text-primary" />
              <p>No goal templates found matching your criteria.</p>
              {searchTerm.trim() && isAiSearchEnabled && (
                <Button onClick={() => openAddGoalTemplateModal(searchTerm)} className="mt-4">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate New Goal from Search
                </Button>
              )}
            </div>
          )}

          {!loading && !isAiSearching && filteredAndSortedTemplates.length > 0 && (
            <div className={cn("grid gap-4", gridClasses[gridSize])}>
              {filteredAndSortedTemplates.map((template) => {
                const relevanceScore = relevanceScoreMap.get(template.id);
                return (
                  <Card key={template.id} className={cn("flex flex-col justify-between hover:shadow-md transition-shadow", template.isArchived && "opacity-60 bg-muted/30")}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-semibold leading-tight">{template.name}</CardTitle>
                         <div className="flex items-center gap-1.5">
                          {relevanceScore !== undefined && (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                              {relevanceScore}%
                            </Badge>
                          )}
                          {template.isArchived ? 
                            <Badge variant='outline' className="border-orange-500 text-orange-600">Archived</Badge> 
                            : (template.isDefault && <Badge variant="outline">Default</Badge>)
                          }
                        </div>
                      </div>
                      <Badge variant="secondary" className="mt-1 w-fit">
                        {template.type === 'AAC' ? 'AAC' : template.type.replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
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
                        {template.isDefault ? (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleArchiveToggle(template)} title={template.isArchived ? "Unarchive Template" : "Archive Template"}>
                             {template.isArchived ? <ArchiveRestore className="h-4 w-4 text-green-600"/> : <Archive className="h-4 w-4 text-orange-600"/>}
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDeleteConfirmationModal(template, 'goalTemplate')}>
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
