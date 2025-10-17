
import { useState, useMemo, useCallback } from 'react';
import type { GoalTemplate } from '@/lib/types';
import { findRelevantGoals } from '@/ai/flows/semantic-search-flow';

export type SearchType = 'standard' | 'semantic';
export type SortType = 'name-asc' | 'name-desc' | 'type-asc' | 'type-desc';

export function useGoalTemplateSearch(allGoals: GoalTemplate[]) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('standard');
  const [sort, setSort] = useState<SortType>('name-asc');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [semanticSearchResults, setSemanticSearchResults] = useState<string[]>([]);
  const [isSemanticSearchLoading, setIsSemanticSearchLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (searchType === 'semantic' && searchTerm.trim()) {
      setIsSemanticSearchLoading(true);
      try {
        const goalsToSearch = allGoals.map(({ id, name, type, smartGoalPrompt }) => ({
          id,
          name,
          type,
          smartGoalPrompt: smartGoalPrompt || '',
        }));
        const result = await findRelevantGoals({ query: searchTerm, goals: goalsToSearch });
        setSemanticSearchResults(result.rankedGoals.map(g => g.id));
      } catch (error) {
        console.error('Semantic search failed:', error);
        setSemanticSearchResults([]);
      } finally {
        setIsSemanticSearchLoading(false);
      }
    }
  }, [searchTerm, searchType, allGoals]);

  const filteredAndSortedGoals = useMemo(() => {
    let goals = [...allGoals];

    if (selectedCategories.length > 0) {
      goals = goals.filter(goal => selectedCategories.includes(goal.type));
    }

    if (searchTerm.trim() && searchType === 'standard') {
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      goals = goals.filter(
        goal =>
          goal.name.toLowerCase().includes(lowercasedSearchTerm) ||
          (goal.smartGoalPrompt || '').toLowerCase().includes(lowercasedSearchTerm)
      );
    }

    if (searchType === 'semantic' && semanticSearchResults.length > 0) {
        goals = goals.filter(g => semanticSearchResults.includes(g.id))
                     .sort((a, b) => semanticSearchResults.indexOf(a.id) - semanticSearchResults.indexOf(b.id));
    } else if (searchType === 'semantic' && searchTerm.trim() && !isSemanticSearchLoading) {
        goals = [];
    }

    if (searchType !== 'semantic') {
        goals.sort((a, b) => {
            switch (sort) {
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                case 'type-asc':
                    return a.type.localeCompare(b.type);
                case 'type-desc':
                    return b.type.localeCompare(a.type);
                default:
                    return 0;
            }
        });
    }

    return goals;
  }, [allGoals, searchTerm, searchType, sort, selectedCategories, semanticSearchResults, isSemanticSearchLoading]);

  return {
    searchTerm,
    setSearchTerm,
    searchType,
    setSearchType,
    sort,
    setSort,
    selectedCategories,
    setSelectedCategories,
    isSemanticSearchLoading,
    handleSearch,
    filteredAndSortedGoals,
  };
}
