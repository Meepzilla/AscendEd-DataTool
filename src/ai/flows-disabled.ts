// Replaces the modules in src/ai/flows/ in builds with no server (`npm run build:static`), where
// server actions can't run. The UI hides AI features in those builds (see AI_ENABLED), so
// these are never expected to be called.

const disabled = async (): Promise<never> => {
  throw new Error('AI features are not available in this build.');
};

export const generateSmartGoal = disabled;
export const getActivitySuggestions = disabled;
export const findRelevantGoals = disabled;
export const generateTechnicalSummary = disabled;
