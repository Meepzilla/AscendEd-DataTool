'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GOAL_TYPES } from '@/lib/goal-constants';
import { goalTypeLabel } from '@/lib/helpers';
import type { useTemplatePicker } from '@/hooks/use-template-picker';

const SORTED_GOAL_TYPES = Object.values(GOAL_TYPES).sort((a, b) => goalTypeLabel(a).localeCompare(goalTypeLabel(b)));

/** Search box plus Type and Skill Area filters for a goal template picker. */
export default function TemplatePickerFilters({ picker }: { picker: ReturnType<typeof useTemplatePicker> }) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search goal name or full goal text..."
          value={picker.search}
          onChange={(e) => picker.setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={picker.typeFilter} onValueChange={picker.setTypeFilter}>
          <SelectTrigger className="h-9" aria-label="Filter by type">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {SORTED_GOAL_TYPES.map(type => (
              <SelectItem key={type} value={type}>{goalTypeLabel(type)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={picker.categoryFilter} onValueChange={picker.setCategoryFilter}>
          <SelectTrigger className="h-9" aria-label="Filter by skill area">
            <SelectValue placeholder="All Skill Areas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Skill Areas</SelectItem>
            {picker.categories.map(category => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
