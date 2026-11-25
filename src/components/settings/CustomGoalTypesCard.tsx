'use client';

import React, { Suspense, lazy, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Archive, ArchiveRestore, Copy, Download, Edit, PlusCircle, RefreshCw, Sliders, Trash2, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useStudentData } from '@/hooks/use-student-data';
import { useToast } from '@/hooks/use-toast';
import {
  applyCustomGoalTypeUpdate,
  exportCustomGoalTypesJson,
} from '@/lib/custom-goal-types';
import { useCustomGoalTypes } from '@/hooks/use-custom-goal-types';
import { CUSTOM_MEASURE_KIND_INFO, customTypeSummary } from '@/lib/goal-types/custom';
import { saveTextFile } from '@/lib/save-file';
import { plural } from '@/lib/helpers';
import type { CustomGoalType } from '@/lib/types';

const CustomGoalTypeModal = lazy(() => import('@/components/modals/custom-goal-type-modal'));

export default function CustomGoalTypesCard() {
  const { currentUser } = useAuth();
  const { students, goalTemplates, updateStudent, updateGoalTemplate } = useStudentData();
  const { toast } = useToast();
  const {
    customTypes,
    saveCustomType,
    duplicateCustomType,
    setCustomTypeArchived,
    deleteCustomType,
    importCustomTypes,
  } = useCustomGoalTypes(currentUser?.uid);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<CustomGoalType | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const usageById = useMemo(() => {
    const map = new Map<string, { goals: number; templates: number; outdatedGoals: number; outdatedTemplates: number }>();
    for (const ct of customTypes) {
      map.set(ct.id, { goals: 0, templates: 0, outdatedGoals: 0, outdatedTemplates: 0 });
    }
    const versionById = new Map(customTypes.map(ct => [ct.id, ct.version || 1]));
    for (const student of students) {
      for (const goal of student.goals || []) {
        if (goal.type === 'CUSTOM' && goal.customType?.id) {
          const id = goal.customType.id;
          const entry = map.get(id) ?? { goals: 0, templates: 0, outdatedGoals: 0, outdatedTemplates: 0 };
          entry.goals++;
          const latestVersion = versionById.get(id);
          if (latestVersion && (goal.customType.version || 1) < latestVersion) {
            entry.outdatedGoals++;
          }
          map.set(id, entry);
        }
      }
    }
    for (const template of goalTemplates) {
      if (template.type === 'CUSTOM' && template.customType?.id) {
        const id = template.customType.id;
        const entry = map.get(id) ?? { goals: 0, templates: 0, outdatedGoals: 0, outdatedTemplates: 0 };
        entry.templates++;
        const latestVersion = versionById.get(id);
        if (latestVersion && (template.customType.version || 1) < latestVersion) {
          entry.outdatedTemplates++;
        }
        map.set(id, entry);
      }
    }
    return map;
  }, [customTypes, students, goalTemplates]);

  const archivedCount = useMemo(() => customTypes.filter(t => t.isArchived).length, [customTypes]);
  const visibleTypes = useMemo(
    () => customTypes.filter(t => (showArchived ? true : !t.isArchived)),
    [customTypes, showArchived],
  );

  const handleOpenCreate = () => {
    setEditingType(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ct: CustomGoalType) => {
    setEditingType(ct);
    setIsModalOpen(true);
  };

  const handleUpdateExistingToLatest = async (ct: CustomGoalType) => {
    let updatedGoals = 0;
    let updatedTemplates = 0;
    for (const student of students) {
      const hasOutdated = (student.goals || []).some(
        g => g.type === 'CUSTOM' && g.customType?.id === ct.id && (g.customType.version || 1) < (ct.version || 1),
      );
      if (hasOutdated) {
        const nextGoals = (student.goals || []).map(g => {
          if (g.type === 'CUSTOM' && g.customType?.id === ct.id && (g.customType.version || 1) < (ct.version || 1)) {
            updatedGoals++;
            return applyCustomGoalTypeUpdate(g, ct);
          }
          return g;
        });
        await updateStudent(student.id, { goals: nextGoals });
      }
    }
    for (const template of goalTemplates) {
      if (template.type === 'CUSTOM' && template.customType?.id === ct.id && (template.customType.version || 1) < (ct.version || 1)) {
        updatedTemplates++;
        await updateGoalTemplate(template.id, { customType: applyCustomGoalTypeUpdate(template, ct).customType });
      }
    }
    toast({
      title: 'Goals Updated',
      description: `Updated ${plural(updatedGoals, 'student goal')} and ${plural(updatedTemplates, 'template')} to the latest version of “${ct.name}”.`,
    });
  };

  const handleExport = async () => {
    if (customTypes.length === 0) return;
    const json = exportCustomGoalTypesJson(customTypes);
    await saveTextFile('AscendEd-custom-goal-types.json', json);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const [text, { parseCustomGoalTypesImport }] = await Promise.all([
        file.text(),
        import('@/lib/custom-goal-types-import'),
      ]);
      const parsed = parseCustomGoalTypesImport(text);
      const { added, updated } = importCustomTypes(parsed);
      toast({
        title: 'Custom Goal Types Imported',
        description: `${plural(added, 'type')} added${updated ? `, ${plural(updated, 'type')} updated` : ''}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Import Failed',
        description: err?.message || 'Could not read custom goal types from that file.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card id="custom-goal-types">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-primary" />
              Custom Goal Types
            </CardTitle>
            <CardDescription>
              Build your own ways of measuring goals (rating scales, counters, timers, checklists, accuracy tallies, or yes/no questions). Each goal keeps a snapshot of its type, so editing a type later never alters past sessions.
            </CardDescription>
          </div>
          <Button type="button" onClick={handleOpenCreate}>
            <PlusCircle className="h-4 w-4 mr-1.5" />
            New Goal Type
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {archivedCount > 0 && (
          <div className="flex items-center justify-end gap-2">
            <Switch
              id="show-archived-custom-types"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label htmlFor="show-archived-custom-types" className="text-xs text-muted-foreground cursor-pointer">
              Show archived ({archivedCount})
            </Label>
          </div>
        )}

        {visibleTypes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-2">
            <p className="text-sm font-medium">No custom goal types yet</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Create a custom goal type when you want your own rating scale, checklist steps, counter, timer, or button labels in Data Entry and Reports.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={handleOpenCreate}>
              <PlusCircle className="h-4 w-4 mr-1.5" />
              Create your first custom goal type
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleTypes.map((ct) => {
              const usage = usageById.get(ct.id) ?? { goals: 0, templates: 0, outdatedGoals: 0, outdatedTemplates: 0 };
              const totalUsed = usage.goals + usage.templates;
              const totalOutdated = usage.outdatedGoals + usage.outdatedTemplates;
              const kindInfo = CUSTOM_MEASURE_KIND_INFO[ct.kind];
              return (
                <div
                  key={ct.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 bg-card"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ backgroundColor: ct.color }}
                      aria-hidden
                    >
                      {ct.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-sm">{ct.name}</span>
                        <Badge variant="secondary" className="text-[11px]">
                          {kindInfo.shortLabel}
                        </Badge>
                        {ct.isArchived && (
                          <Badge variant="outline" className="text-[11px] text-orange-600 border-orange-500">
                            Archived
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {customTypeSummary(ct)}
                        {' · '}
                        {totalUsed === 0
                          ? 'Not used by any goals yet'
                          : `Used by ${plural(usage.goals, 'student goal')} and ${plural(usage.templates, 'template')}`}
                      </p>
                      {ct.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{ct.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {totalOutdated > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleUpdateExistingToLatest(ct)}
                        title="Update existing goals and templates using this type to the latest version"
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        Update {totalOutdated} to latest
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => handleOpenEdit(ct)}>
                      <Edit className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const copy = duplicateCustomType(ct.id);
                        if (copy) toast({ title: 'Duplicated', description: `Created “${copy.name}”.` });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Duplicate
                    </Button>
                    {totalUsed > 0 || ct.isArchived ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCustomTypeArchived(ct.id, !ct.isArchived)}
                      >
                        {ct.isArchived ? (
                          <><ArchiveRestore className="h-3.5 w-3.5 mr-1" />Restore</>
                        ) : (
                          <><Archive className="h-3.5 w-3.5 mr-1" />Archive</>
                        )}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          deleteCustomType(ct.id);
                          toast({ title: 'Deleted', description: `Removed “${ct.name}”.` });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleExport()}
            disabled={customTypes.length === 0}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export types (.json)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Import types
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => void handleImportFile(e)}
          />
        </div>
      </CardContent>

      <Suspense fallback={null}>
        {isModalOpen && (
          <CustomGoalTypeModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            initialType={editingType}
            saveCustomType={saveCustomType}
            onSave={(saved) => {
              toast({
                title: editingType ? 'Goal Type Updated' : 'Goal Type Created',
                description: `“${saved.name}” is ready to use in goal templates and student goals.`,
              });
            }}
          />
        )}
      </Suspense>
    </Card>
  );
}
