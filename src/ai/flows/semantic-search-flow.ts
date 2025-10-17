'use server';
/**
 * @fileOverview An AI flow for performing semantic search on goal templates.
 *
 * - findRelevantGoals - A function that takes a search query and a list of goals and returns a ranked list of goal IDs.
 * - FindRelevantGoalsInput - The input type for the findRelevantGoals function.
 * - FindRelevantGoalsOutput - The return type for the findRelevantGoals function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GoalInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  smartGoalPrompt: z.string().optional(),
});

const FindRelevantGoalsInputSchema = z.object({
  query: z.string().describe('The user\'s search query.'),
  goals: z.array(GoalInfoSchema).describe('The list of all available goal templates to search through.'),
});
export type FindRelevantGoalsInput = z.infer<typeof FindRelevantGoalsInputSchema>;

const FindRelevantGoalsOutputSchema = z.object({
  rankedGoalIds: z.array(z.string()).describe('An array of goal IDs, ranked from most to least relevant based on the user query.'),
});
export type FindRelevantGoalsOutput = z.infer<typeof FindRelevantGoalsOutputSchema>;

export async function findRelevantGoals(
  input: FindRelevantGoalsInput
): Promise<FindRelevantGoalsOutput> {
  return findRelevantGoalsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'findRelevantGoalsPrompt',
  input: {schema: FindRelevantGoalsInputSchema},
  output: {schema: FindRelevantGoalsOutputSchema},
  prompt: `You are a semantic search engine for a library of educational goal templates for students.
Your task is to analyze the user's search query and rank the provided goal templates based on their semantic relevance to the query.

User Query: "{{query}}"

Available Goal Templates:
{{#each goals}}
- ID: {{id}}, Name: {{name}}, Type: {{type}}, Description: {{smartGoalPrompt}}
{{/each}}

Analyze the query and the templates. Return a JSON object containing a single key "rankedGoalIds", which is an array of the goal IDs sorted from most relevant to least relevant. Do not include goals that are completely irrelevant. The closer the conceptual match, the higher the rank should be. Consider synonyms, related concepts, and the overall intent of the query.
`,
});

const findRelevantGoalsFlow = ai.defineFlow(
  {
    name: 'findRelevantGoalsFlow',
    inputSchema: FindRelevantGoalsInputSchema,
    outputSchema: FindRelevantGoalsOutputSchema,
  },
  async (input: FindRelevantGoalsInput) => {
    if (input.goals.length === 0) {
      return { rankedGoalIds: [] };
    }
    const {output} = await prompt(input);
    return output!;
  }
);
