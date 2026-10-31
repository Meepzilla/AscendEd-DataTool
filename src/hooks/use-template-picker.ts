'use client';

import { useMemo, useState } from 'react';
import type { GoalTemplate, Student } from '@/lib/types';
import { templateMatchesSearch } from '@/lib/helpers';
import { getRecentTemplateIds, hasTemplateGoal } from '@/lib/goal-templates';

/**
 * Search and filters for choosing goal templates to give a student: matches the name, full goal text and
 * skill area; filters by type and skill area; leaves out archived templates and ones the student already
 * has. With no search or filters, recently assigned templates come first.
 */
export function useTemplatePicker(goalTemplates: GoalTemplate[], student: Pick<Student, 'goals'> | null | undefined, userId: string | undefined) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const categories = useMemo(
    () => Array.from(new Set(goalTemplates.filter(t => !t.isArchived).map(t => t.category).filter((c): c is string => !!c))).sort((a, b) => a.localeCompare(b)),
    [goalTemplates]
  );

  // Read once per template list change; it only changes when a goal is assigned. goalTemplates and student
  // aren't used inside, but they are what change when it does, so they make it read again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recentIds = useMemo(() => getRecentTemplateIds(userId), [userId, goalTemplates, student]);

  const templates = useMemo(() => {
    const browsing = !search.trim() && typeFilter === 'ALL' && categoryFilter === 'ALL';
    const rank = (t: GoalTemplate) => (browsing && recentIds.includes(t.id) ? recentIds.indexOf(t.id) : recentIds.length);
    return goalTemplates
      .filter(t => !t.isArchived
        && (typeFilter === 'ALL' || t.type === typeFilter)
        && (categoryFilter === 'ALL' || t.category === categoryFilter)
        && templateMatchesSearch(t, search)
        && !(student && hasTemplateGoal(student, t)))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [goalTemplates, student, search, typeFilter, categoryFilter, recentIds]);

  const isRecent = (template: GoalTemplate) =>
    !search.trim() && typeFilter === 'ALL' && categoryFilter === 'ALL' && recentIds.includes(template.id);

  return { search, setSearch, typeFilter, setTypeFilter, categoryFilter, setCategoryFilter, categories, templates, isRecent };
}
