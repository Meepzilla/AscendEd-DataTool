
import type { GoalTemplate } from '../types';

export const AAC_FIELDS: Record<string, Record<string, any>> = {
  AAC: {
    correct: 0,
    incorrect: 0,
    approximate: 0,
    details: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
};

export const AAC_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  // Linguistic Competence
  { name: 'AAC: Combine 2 symbols to create a message', type: 'AAC', smartGoalPrompt: 'Student will combine 2 symbols (e.g., "want more", "go play") to create a functional message on their AAC device.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'AAC: Use core words in phrases', type: 'AAC', smartGoalPrompt: 'Student will use at least 10 different core vocabulary words in phrases on their AAC device.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'AAC: Formulate a grammatically correct sentence', type: 'AAC', smartGoalPrompt: 'Student will use their AAC system to formulate a grammatically correct sentence of 3+ words.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },

  // Operational Competence
  { name: 'AAC: Navigate to a desired page/folder', type: 'AAC', smartGoalPrompt: 'Student will independently navigate to a desired page or folder on their AAC device.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: '' },
  { name: 'AAC: Activate the device and locate the home page', type: 'AAC', smartGoalPrompt: 'Student will independently turn on their AAC device and navigate to the main/home screen.', isDefault: true, sessionTargetValue: 95, generatedSmartGoal: '' },
  { name: 'AAC: Use access method (e.g., switch, eye gaze) efficiently', type: 'AAC', smartGoalPrompt: 'Student will use their prescribed access method (e.g., switch scanning, eye gaze) to select a target with no more than 1 error.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },

  // Social Competence
  { name: 'AAC: Use device to make a request', type: 'AAC', smartGoalPrompt: 'Student will use their AAC system to spontaneously request a desired object or activity.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'AAC: Use device to make a comment', type: 'AAC', smartGoalPrompt: 'Student will use their AAC system to make a comment during a shared activity.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'AAC: Use device to gain attention', type: 'AAC', smartGoalPrompt: 'Student will use a pre-programmed message (e.g., "excuse me") to gain a communication partner\'s attention.', isDefault: true, sessionTargetValue: 85, generatedSmartGoal: '' },
  { name: 'AAC: Take a turn in a conversation', type: 'AAC', smartGoalPrompt: 'Student will use their AAC device to take a conversational turn in a structured exchange.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },

  // Strategic Competence
  { name: 'AAC: Use a phrase to indicate "I have something to say"', type: 'AAC', smartGoalPrompt: 'Student will use a strategic phrase (e.g., "My turn," "I have something to say") to hold their conversational turn while navigating their device.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'AAC: Indicate when a vocabulary word is missing', type: 'AAC', smartGoalPrompt: 'Student will use a strategy (e.g., pointing to "word not here," saying "help") to indicate when a needed word is not available on their device.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
];
