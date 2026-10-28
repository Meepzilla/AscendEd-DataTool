
'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GOAL_TYPES } from '@/lib/goal-constants';
import { ListFilter, Search, ArrowUpDown, Grid, BrainCircuit, Sparkles, Loader2, Archive, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AI_ENABLED } from '@/lib/features';
import { goalTypeLabel } from '@/lib/helpers';

export type GoalTemplateSortOrder = 'relevance' | 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';
export type GridSize = 'sm' | 'md' | 'lg';

interface GoalTemplateFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filterType: string;
  setFilterType: (value: string) => void;
  filterCategory: string;
  setFilterCategory: (value: string) => void;
  categories: string[];
  sortOrder: GoalTemplateSortOrder;
  setSortOrder: (value: GoalTemplateSortOrder) => void;
  gridSize: GridSize;
  setGridSize: (value: GridSize) => void;
  isAiSearchEnabled: boolean;
  setIsAiSearchEnabled: (value: boolean) => void;
  isAiSearching: boolean;
  onSemanticSearch: () => void;
  onClearAiSearch: () => void;
  showArchived: boolean;
  setShowArchived: (value: boolean) => void;
}

const GoalTemplateFilters: React.FC<GoalTemplateFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  filterCategory,
  setFilterCategory,
  categories,
  sortOrder,
  setSortOrder,
  gridSize,
  setGridSize,
  isAiSearchEnabled,
  setIsAiSearchEnabled,
  isAiSearching,
  onSemanticSearch,
  onClearAiSearch,
  showArchived,
  setShowArchived,
}) => {

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault(); 
      if (isAiSearchEnabled) {
        if (searchTerm.trim()) {
          onSemanticSearch();
        } else {
          onClearAiSearch();
        }
      }
    }
  };

  const sortedGoalTypes = React.useMemo(() => Object.values(GOAL_TYPES).sort((a, b) => a.localeCompare(b)), []);

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <div className="relative flex-grow min-w-[200px]">
        <div className={cn("absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground", isAiSearchEnabled && "text-yellow-500")}>
          {isAiSearching ? <Loader2 className="animate-spin" /> : isAiSearchEnabled ? <Sparkles /> : <Search />}
        </div>
        <Input
          type="search"
          placeholder={isAiSearchEnabled ? "AI Semantic Search... (Press Enter)" : "Filter by keyword..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleSearchKeyDown}
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
          {sortedGoalTypes.map(type => (
            <SelectItem key={type} value={type}>
              {goalTypeLabel(type)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {categories.length > 0 && (
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <Layers className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Filter by skill area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Skill Areas</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as GoalTemplateSortOrder)}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {isAiSearchEnabled && <SelectItem value="relevance">Relevance</SelectItem>}
          <SelectItem value="date-desc">Date: Newest</SelectItem>
          <SelectItem value="date-asc">Date: Oldest</SelectItem>
          <SelectItem value="name-asc">Name: A-Z</SelectItem>
          <SelectItem value="name-desc">Name: Z-A</SelectItem>
        </SelectContent>
      </Select>
      <Select value={gridSize} onValueChange={(value) => setGridSize(value as GridSize)}>
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
      {AI_ENABLED && (
        <div className="flex items-center space-x-2 border p-2 rounded-md">
          <Switch
            id="ai-search-toggle"
            checked={isAiSearchEnabled}
            onCheckedChange={setIsAiSearchEnabled}
          />
          <Label htmlFor="ai-search-toggle" className="flex items-center gap-1.5 text-sm cursor-pointer">
            <BrainCircuit className="h-4 w-4" /> AI Search
          </Label>
        </div>
      )}
      <div className="flex items-center space-x-2 border p-2 rounded-md">
        <Switch
          id="show-archived-toggle"
          checked={showArchived}
          onCheckedChange={setShowArchived}
        />
        <Label htmlFor="show-archived-toggle" className="flex items-center gap-1.5 text-sm cursor-pointer">
          <Archive className="h-4 w-4" /> Show Archived
        </Label>
      </div>
    </div>
  );
};

export default GoalTemplateFilters;
