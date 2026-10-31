import type { GoalTemplate } from '../types';

// Task analysis: steps are set on each student's goal (Edit Goal → Task Steps); a session stores each step's
// score (task-analysis.ts).
export const TASK_ANALYSIS_FIELDS: Record<string, Record<string, any>> = {
  TASK_ANALYSIS: { steps: [], notes: '' },
};

export const TASK_ANALYSIS_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  { name: 'Complete the handwashing routine (task analysis)', type: 'TASK_ANALYSIS', smartGoalPrompt: 'By [date], STUDENT will independently complete the steps of the handwashing routine in 80% of steps across 3 consecutive sessions, as measured by staff observation and data collection.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: 'By [date], STUDENT will independently complete the steps of the handwashing routine in 80% of steps across 3 consecutive sessions, as measured by staff observation and data collection.', taskSteps: ['Turn on water', 'Wet hands', 'Get soap', 'Scrub for 20 seconds', 'Rinse hands', 'Turn off water', 'Dry hands'] },
  { name: 'Complete the arrival routine (task analysis)', type: 'TASK_ANALYSIS', smartGoalPrompt: 'By [date], STUDENT will independently complete the steps of the classroom arrival routine in 80% of steps across 3 consecutive sessions, as measured by staff observation and data collection.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: 'By [date], STUDENT will independently complete the steps of the classroom arrival routine in 80% of steps across 3 consecutive sessions, as measured by staff observation and data collection.', taskSteps: ['Greet staff', 'Hang up backpack', 'Put away lunch', 'Turn in homework', 'Check visual schedule', 'Go to seat'] },
  { name: 'Use a communication device to make a request (task analysis)', type: 'TASK_ANALYSIS', smartGoalPrompt: 'By [date], STUDENT will independently complete the steps of making a request with a communication device in 80% of steps across 3 consecutive sessions, as measured by SLP or teacher observation and data collection.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: 'By [date], STUDENT will independently complete the steps of making a request with a communication device in 80% of steps across 3 consecutive sessions, as measured by SLP or teacher observation and data collection.', taskSteps: ['Gain a partner\'s attention', 'Open the device', 'Navigate to the right page', 'Select the item', 'Speak the message', 'Wait for a response'] },
];
