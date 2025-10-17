'use server';
/**
 * @fileOverview An AI flow for performing semantic search on goal templates.
 *
 * - findRelevantGoals - A function that takes a search query and a list of goals and returns a ranked list of goal IDs with relevance scores.
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

export type FindRelevantGoalsInput = z.infer<typeof FindRelevantGoalsInputSchema>;
const FindRelevantGoalsInputSchema = z.object({
  query: z.string().describe('The user\'s search query.'),
  goals: z.array(GoalInfoSchema).describe('The list of all available goal templates to search through.'),
});

const RankedGoalSchema = z.object({
  id: z.string().describe('The ID of the goal template.'),
  relevanceScore: z.number().min(0).max(100).describe('A percentage score (0-100) indicating how relevant the goal is to the user query.'),
});

export type FindRelevantGoalsOutput = z.infer<typeof FindRelevantGoalsOutputSchema>;
const FindRelevantGoalsOutputSchema = z.object({
  rankedGoals: z.array(RankedGoalSchema).describe('An array of goal objects, ranked from most to least relevant, each with an ID and a relevance score.'),
});

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
Your task is to analyze the user's search query and rank the provided goal templates based on their semantic relevance.

User Query: "{{query}}"

Available Goal Templates:
{{#each goals}}
- ID: {{id}}, Name: {{name}}, Type: {{type}}, Description: {{smartGoalPrompt}}
{{/each}}

Analyze the query and the templates. For each relevant goal, provide its ID and a "relevanceScore" from 0 to 100, where 100 is a perfect match. Return a JSON object containing a single key "rankedGoals", which is an array of objects, each with an "id" and a "relevanceScore". Sort the array from most relevant to least relevant. Do not include goals that are completely irrelevant.
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
      return { rankedGoals: [] };
    }
    const {output} = await prompt(input);
    return output!;
  }
);
