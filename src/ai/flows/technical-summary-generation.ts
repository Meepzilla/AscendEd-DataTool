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
  goalName: z.string().describe('The name of the goal or "overall progress" if multiple goals are considered.'),
  progressData: z.string().describe('A detailed description of the student\'s progress towards the goal, including recent session notes, activities, and performance metrics like accuracy, response counts, opportunities, and prompt counts.'),
});
export type TechnicalSummaryInput = z.infer<typeof TechnicalSummaryInputSchema>;

const TechnicalSummaryOutputSchema = z.object({
  summary: z.string().describe('A technical summary of the student\'s progress, focusing on trends and key observations.'),
  progress: z.string().describe('A one-sentence summary of the AI generation task completed.'),
});
export type TechnicalSummaryOutput = z.infer<typeof TechnicalSummaryOutputSchema>;

export async function generateTechnicalSummary(input: TechnicalSummaryInput): Promise<TechnicalSummaryOutput> {
  return generateTechnicalSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'technicalSummaryPrompt',
  input: {schema: TechnicalSummaryInputSchema},
  output: {schema: TechnicalSummaryOutputSchema},
  prompt: `You are an AI assistant specializing in synthesizing student progress data into concise, technical summaries for educators. Your role is to present the facts clearly without adding interpretation or speculation.

Your task is to analyze the provided information for {{studentName}} regarding their work on "{{goalName}}". The input includes recent session notes, activities, and performance metrics (accuracy, response counts, opportunities, prompt counts).

Generate a technical summary that:
1.  Identifies key trends or significant changes in performance (e.g., improvements, declines, plateaus) based *only* on the provided data.
2.  Refers to specific data points (e.g., accuracy percentages, number of opportunities, prompt counts) to support your observations.
3.  If prompt data is available and greater than zero, explicitly mention the prompting levels required. For example, "Correct responses were achieved with moderate verbal and visual prompting."
4.  Maintains a professional and strictly objective tone. Do not use interpretive language like "seems to be," "suggests," or "appears to."
5.  Is concise, ideally 3-5 sentences.

Student Name: {{{studentName}}}
Goal Focus: {{{goalName}}}
Progress Data (includes session details and quantitative metrics):
{{{progressData}}}

Synthesize this information into a factual, technical summary.
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
      progress: 'Generated a technical summary of student progress.' // This describes the AI's action
    };
  }
);
