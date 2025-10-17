
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
  // --- Foundational & Early Communication Functions ---
  { name: 'AAC: Activate single message for cause and effect', type: 'AAC', smartGoalPrompt: 'Student will activate a single, pre-programmed message on an AAC device or switch to demonstrate cause and effect (e.g., activating "music" to play a song) during a play activity.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'AAC: Make a choice between two options', type: 'AAC', smartGoalPrompt: 'When presented with two options on their AAC system, the student will make a clear choice to indicate a preference.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: '' },
  { name: 'AAC: Use device to make a request', type: 'AAC', smartGoalPrompt: 'Student will use their AAC system to spontaneously request a desired object or activity across 3 different opportunities.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'AAC: Use device to reject or protest', type: 'AAC', smartGoalPrompt: 'Student will use their AAC system (e.g., selecting "no," "stop," or "all done") to reject or protest an undesired item or activity.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'AAC: Use device for social greetings', type: 'AAC', smartGoalPrompt: 'Student will use their AAC system to say "hello" and "goodbye" at the beginning and end of a session or interaction.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: '' },
  
  // --- Linguistic Competence ---
  { name: 'AAC: Combine 2 symbols to create a message', type: 'AAC', smartGoalPrompt: 'Student will combine 2 symbols (e.g., "want more," "go play") to create a functional message on their AAC device.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'AAC: Combine 3+ symbols to form a sentence', type: 'AAC', smartGoalPrompt: 'Student will combine 3 or more symbols to formulate a grammatically correct sentence to comment, request, or ask a question.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'AAC: Use core words in phrases', type: 'AAC', smartGoalPrompt: 'Student will use at least 10 different core vocabulary words in phrases on their AAC device during a structured activity.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'AAC: Use fringe vocabulary for specific topics', type: 'AAC', smartGoalPrompt: 'Student will navigate to a folder and select specific (fringe) vocabulary to talk about a preferred topic (e.g., dinosaurs, space).', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'AAC: Use descriptive words (adjectives)', type: 'AAC', smartGoalPrompt: 'Student will use their AAC system to combine an adjective and a noun (e.g., "big ball," "blue car") to describe an object.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },

  // --- Operational Competence ---
  { name: 'AAC: Navigate to a desired page/folder', type: 'AAC', smartGoalPrompt: 'Student will independently navigate between at least two different pages or folders on their AAC device to locate vocabulary.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: '' },
  { name: 'AAC: Use access method (e.g., switch, eye gaze) efficiently', type: 'AAC', smartGoalPrompt: 'Student will use their prescribed access method (e.g., switch scanning, eye gaze) to select a target with no more than 1 error across 5 trials.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'AAC: Adjust volume for social context', type: 'AAC', smartGoalPrompt: 'Student will independently adjust the volume on their device to be appropriate for the social setting (e.g., louder in a group, quieter in the library).', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },

  // --- Social Competence ---
  { name: 'AAC: Use device to make a comment', type: 'AAC', smartGoalPrompt: 'Student will use their AAC system to make a relevant, spontaneous comment during a shared activity.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'AAC: Ask a "Wh-" question to a peer', type: 'AAC', smartGoalPrompt: 'Student will use their AAC system to formulate and ask a "Wh-" question (who, what, where) to a peer.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'AAC: Express an opinion or feeling', type: 'AAC', smartGoalPrompt: 'Student will use their AAC system to express an opinion or feeling (e.g., "I like that," "I feel happy").', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'AAC: Take a turn in a conversation', type: 'AAC', smartGoalPrompt: 'Student will use their AAC device to take a conversational turn in a structured exchange with a peer or adult.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'AAC: Use device to gain attention appropriately', type: 'AAC', smartGoalPrompt: 'Student will use a pre-programmed message (e.g., "excuse me," "look") to gain a communication partner\'s attention before communicating.', isDefault: true, sessionTargetValue: 85, generatedSmartGoal: '' },

  // --- Strategic Competence ---
  { name: 'AAC: Use a phrase to indicate "I have something to say"', type: 'AAC', smartGoalPrompt: 'Student will use a strategic phrase (e.g., "My turn," "Wait") to hold their conversational turn while navigating their device.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'AAC: Indicate when a vocabulary word is missing', type: 'AAC', smartGoalPrompt: 'Student will use a strategy (e.g., pointing to "word not here," saying "help") to indicate when a needed word is not available on their device.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'AAC: Repair a communication breakdown', type: 'AAC', smartGoalPrompt: 'When a communication partner does not understand, the student will use a strategy to repair the breakdown (e.g., trying the message again, pointing, adding another word).', isDefault: true, sessionTargetValue: 70, generatedSmartGoal: '' },

  // --- Multimodal Communication ---
  { name: 'AAC: Pair a gesture with a selected symbol', type: 'AAC', smartGoalPrompt: 'Student will pair a non-verbal gesture (e.g., pointing, waving) with a corresponding message on their AAC system.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'AAC: Pair a vocalization/word approximation with device use', type: 'AAC', smartGoalPrompt: 'Student will pair a vocalization or word approximation with their AAC device selection to create a multimodal message.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'AAC: Use body language to supplement a message', type: 'AAC', smartGoalPrompt: 'Student will use appropriate body language (e.g., nodding, shaking head) in conjunction with their AAC message to add clarity or emphasis.', isDefault: true, sessionTargetValue: 85, generatedSmartGoal: '' },
];
