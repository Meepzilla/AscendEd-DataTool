'use server';

/**
 * @fileOverview An AI agent for generating technical summaries of student progress.
 *
 * - generateTechnicalSummary - A function that generates a technical summary of student progress.
 * - TechnicalSummaryInput - The input type for the generateTechnicalSummary function.
 * - TechnicalSummaryOutput - The return type for the generateTechnicalSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TechnicalSummaryInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  goalName: z.string().describe('The name of the goal.'),
  progressData: z.string().describe('A detailed description of the student\'s progress towards the goal.'),
});
export type TechnicalSummaryInput = z.infer<typeof TechnicalSummaryInputSchema>;

const TechnicalSummaryOutputSchema = z.object({
  summary: z.string().describe('A technical summary of the student\'s progress.'),
  progress: z.string().describe('A one-sentence summary of the generated content.'),
});
export type TechnicalSummaryOutput = z.infer<typeof TechnicalSummaryOutputSchema>;

export async function generateTechnicalSummary(input: TechnicalSummaryInput): Promise<TechnicalSummaryOutput> {
  return generateTechnicalSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'technicalSummaryPrompt',
  input: {schema: TechnicalSummaryInputSchema},
  output: {schema: TechnicalSummaryOutputSchema},
  prompt: `You are an AI assistant that helps educators analyze student progress.

  Given the student's name, goal, and progress data, generate a concise technical summary of their progress.

  Student Name: {{{studentName}}}
  Goal Name: {{{goalName}}}
  Progress Data: {{{progressData}}}
  `,
});

const generateTechnicalSummaryFlow = ai.defineFlow(
  {
    name: 'generateTechnicalSummaryFlow',
    inputSchema: TechnicalSummaryInputSchema,
    outputSchema: TechnicalSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return {
      ...output!,
      progress: 'Generated a technical summary of student progress.'
    };
  }
);
