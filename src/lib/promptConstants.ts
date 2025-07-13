
import type { PromptType } from './types';

// -- Prompting Constants --
// Defines the ordered list of prompt types used in the application.
export const PROMPT_TYPES: PromptType[] = ["Independent", "Visual", "Verbal", "Gestural", "PartialPhysical", "FullPhysical"];

// Maps keyboard hotkeys to their corresponding prompt types for data entry.
export const PROMPT_HOTKEY_MAP: Record<string, PromptType> = {
  'D': 'Visual', // New hotkey for Visual prompt
  'V': 'Verbal',
  'G': 'Gestural',
  'P': 'PartialPhysical',
  'F': 'FullPhysical',
  'I': 'Independent',
};

// Defines a color palette for different prompt types, used in charts or UI for visual distinction.
export const PROMPT_COLORS: Record<PromptType, string> = {
  Independent: '#8B5CF6', // violet-500
  Visual: '#2DD4BF', // teal-400 (New color)
  Verbal: '#3B82F6', // blue-500
  Gestural: '#10B981', // emerald-500
  PartialPhysical: '#F59E0B', // amber-500
  FullPhysical: '#EF4444', // red-500
};

// Defines short abbreviations for prompt types, useful for compact UI displays.
export const PROMPT_ABBREVIATIONS: Record<PromptType, string> = {
  Independent: 'Ind',
  Visual: 'Vis', // New abbreviation
  Verbal: 'V',
  Gestural: 'G',
  PartialPhysical: 'PP',
  FullPhysical: 'FP',
};
