'use server';
/**
 * @fileOverview Provides AI-driven activity suggestions for educators based on learning goals and student progress.
 *
 * - getActivitySuggestions - A function to get activity suggestions.
 * - ActivitySuggestionsInput - The input type for the getActivitySuggestions function.
 * - ActivitySuggestionsOutput - The return type for the getActivitySuggestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ActivitySuggestionsInputSchema = z.object({
  goal: z.string().describe('The learning goal for which to suggest activities.'),
  studentProgress: z
    .string()
    .describe('A description of the student’s current progress towards the goal.'),
  sessionHistory: z
    .string()
    .optional()
    .describe('Optional: A summary of previous sessions related to this goal.'),
});
export type ActivitySuggestionsInput = z.infer<typeof ActivitySuggestionsInputSchema>;

const ActivitySuggestionsOutputSchema = z.object({
  suggestions: z.array(z.string()).describe('A list of suggested activities.'),
  reasoning: z.string().describe('The AI’s reasoning for suggesting these activities.'),
});
export type ActivitySuggestionsOutput = z.infer<typeof ActivitySuggestionsOutputSchema>;

export async function getActivitySuggestions(
  input: ActivitySuggestionsInput
): Promise<ActivitySuggestionsOutput> {
  return activitySuggestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'activitySuggestionsPrompt',
  input: {schema: ActivitySuggestionsInputSchema},
  output: {schema: ActivitySuggestionsOutputSchema},
  prompt: `You are an AI assistant for educators, helping them come up with activities for their students.\n\nYou will suggest a list of activities appropriate for the specified learning goal, taking into account the student's progress and session history.\n\nGoal: {{{goal}}}\nStudent Progress: {{{studentProgress}}}\nSession History: {{{sessionHistory}}}\n\nSuggest a numbered list of activities, followed by a brief explanation of why these activities are appropriate, separated by a newline.`,
});

const activitySuggestionsFlow = ai.defineFlow(
  {
    name: 'activitySuggestionsFlow',
    inputSchema: ActivitySuggestionsInputSchema,
    outputSchema: ActivitySuggestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
