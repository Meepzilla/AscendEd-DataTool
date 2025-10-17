'use server';

/**
 * @fileOverview A SMART goal generation AI agent.
 *
 * - generateSmartGoal - A function that handles the generation of a SMART goal.
 * - GenerateSmartGoalInput - The input type for the generateSmartGoal function
 * - GenerateSmartGoalOutput - The return type for the generateSmartGoal function
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSmartGoalInputSchema = z.object({
  goalPrompt: z.string().describe('The prompt for generating a SMART goal.'),
});
export type GenerateSmartGoalInput = z.infer<typeof GenerateSmartGoalInputSchema>;

const GenerateSmartGoalOutputSchema = z.object({
  smartGoal: z.string().describe('The generated SMART goal.'),
});
export type GenerateSmartGoalOutput = z.infer<typeof GenerateSmartGoalOutputSchema>;

export async function generateSmartGoal(input: GenerateSmartGoalInput): Promise<GenerateSmartGoalOutput> {
  return generateSmartGoalFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSmartGoalPrompt',
  input: {schema: GenerateSmartGoalInputSchema},
  output: {schema: GenerateSmartGoalOutputSchema},
  prompt: `You are an expert in creating SMART goals for students with learning disabilities.

  Based on the following prompt, generate a SMART goal.

  Prompt: {{{goalPrompt}}}
  `,
});

const generateSmartGoalFlow = ai.defineFlow(
  {
    name: 'generateSmartGoalFlow',
    inputSchema: GenerateSmartGoalInputSchema,
    outputSchema: GenerateSmartGoalOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
