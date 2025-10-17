
import type { GoalTemplate } from '../types';

export const COGNITIVE_FIELDS: Record<string, Record<string, any>> = {
  COGNITIVE: {
    notes: '',
    rating: 3,
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
};

export const COGNITIVE_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  // --- Executive Functioning ---
  { name: 'Cognitive: Initiate a multi-step task', type: 'COGNITIVE', smartGoalPrompt: 'Student will independently initiate a 3-step functional task after a verbal cue.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'Cognitive: Plan materials for a task', type: 'COGNITIVE', smartGoalPrompt: 'Given a task, student will identify and gather necessary materials before beginning.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'Cognitive: Use a checklist to complete a task', type: 'COGNITIVE', smartGoalPrompt: 'Student will use a visual checklist to complete a 4-step classroom routine.', isDefault: true, sessionTargetValue: 5, generatedSmartGoal: '' },
  { name: 'Cognitive: Inhibit impulsive responses', type: 'COGNITIVE', smartGoalPrompt: 'Student will wait to be called on before answering in a small group setting.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'Cognitive: Transition between activities', type: 'COGNITIVE', smartGoalPrompt: 'Student will transition between a non-preferred and a preferred activity with no more than one verbal prompt.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },

  // --- Attention ---
  { name: 'Cognitive: Sustain attention to a non-preferred task', type: 'COGNITIVE', smartGoalPrompt: 'Student will sustain attention to a non-preferred academic task for 5 minutes with minimal redirection.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'Cognitive: Sustain attention to a group activity', type: 'COGNITIVE', smartGoalPrompt: 'Student will sustain attention during a 10-minute group lesson or activity.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'Cognitive: Filter distractions in the classroom', type: 'COGNITIVE', smartGoalPrompt: 'Student will maintain on-task behavior despite typical classroom distractions for a 10-minute interval.', isDefault: true, sessionTargetValue: 3, generatedSmartGoal: '' },
  { name: 'Cognitive: Alternate attention between two tasks', type: 'COGNITIVE', smartGoalPrompt: 'Student will successfully alternate attention between two related tasks (e.g., reading a text and answering questions).', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },

  // --- Memory ---
  { name: 'Cognitive: Recall 3-step directions', type: 'COGNITIVE', smartGoalPrompt: 'Student will recall and follow a 3-step direction after a 30-second delay.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'Cognitive: Use a memory aid for daily routine', type: 'COGNITIVE', smartGoalPrompt: 'Student will use a memory aid (e.g., visual schedule, planner) to independently complete their morning routine.', isDefault: true, sessionTargetValue: 5, generatedSmartGoal: '' },
  { name: 'Cognitive: Recall 3 details from a short story', type: 'COGNITIVE', smartGoalPrompt: 'After listening to a short paragraph, the student will recall 3 key details.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'Cognitive: Improve working memory for sequences', type: 'COGNITIVE', smartGoalPrompt: 'Student will repeat a sequence of 4 numbers or words forward.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
];
