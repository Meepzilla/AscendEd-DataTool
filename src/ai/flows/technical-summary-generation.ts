'use server';

/**
 * @fileOverview An AI flow for generating a technical summary of student performance data.
 *
 * - generateTechnicalSummary - A function that takes session data and returns a narrative summary.
 * - GenerateTechnicalSummaryInput - The input type for the function.
 * - GenerateTechnicalSummaryOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SessionDataSchema = z.object({
  date: z.string(),
  activity: z.string().optional(),
  notes: z.string().optional(),
  goals: z.array(z.object({
    goalName: z.string(),
    goalType: z.string(),
    data: z.record(z.any()),
  })),
});

export const GenerateTechnicalSummaryInputSchema = z.object({
  studentName: z.string(),
  dateRange: z.string(),
  goalFilter: z.string(),
  sessions: z.array(SessionDataSchema),
});
export type GenerateTechnicalSummaryInput = z.infer<typeof GenerateTechnicalSummaryInputSchema>;

export const GenerateTechnicalSummaryOutputSchema = z.object({
  summary: z.string().describe('A technical, data-driven narrative summary of the student\'s performance.'),
});
export type GenerateTechnicalSummaryOutput = z.infer<typeof GenerateTechnicalSummaryOutputSchema>;

export async function generateTechnicalSummary(input: GenerateTechnicalSummaryInput): Promise<GenerateTechnicalSummaryOutput> {
  return generateTechnicalSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTechnicalSummaryPrompt',
  input: { schema: GenerateTechnicalSummaryInputSchema },
  output: { schema: GenerateTechnicalSummaryOutputSchema },
  prompt: `
    You are an expert in analyzing educational and therapeutic data.
    Your task is to generate a concise, professional, and data-driven technical summary based on the provided session data for a student named {{studentName}}.

    The data covers the period: {{dateRange}}.
    The data is filtered for: {{goalFilter}}.

    Analyze the trends in the data. Look for patterns in accuracy, prompting levels, and response types over time.
    In your summary, you MUST:
    - Begin with a clear opening statement about the student's performance during the period.
    - Incorporate specific data points (e.g., accuracy percentages, prompt counts, number of sessions) to support your observations.
    - Mention any notable trends (e.g., "showed an upward trend in accuracy," "required fewer verbal prompts over time").
    - Point out areas of strength and areas that may need continued focus.
    - Keep the summary objective and technical in tone.
    - The summary should be a single, well-structured paragraph.

    Available Session Data:
    {{#each sessions}}
    - Session Date: {{date}}
      {{#if activity}}Activity: "{{activity}}"{{/if}}
      {{#if notes}}General Notes: "{{notes}}"{{/if}}
      {{#each goals}}
      - Goal: "{{goalName}}" ({{goalType}})
        - Data: {{JSON.stringify data}}
      {{/each}}
    {{/each}}
  `,
});


const generateTechnicalSummaryFlow = ai.defineFlow(
  {
    name: 'generateTechnicalSummaryFlow',
    inputSchema: GenerateTechnicalSummaryInputSchema,
    outputSchema: GenerateTechnicalSummaryOutputSchema,
  },
  async (input) => {
    // Ensure the sessions array is not overly large to avoid hitting model context limits.
    // This is a simple example; a more robust solution might summarize older sessions.
    if (input.sessions.length > 50) {
      input.sessions = input.sessions.slice(0, 50);
    }
    const {output} = await prompt(input);
    return output!;
  }
);
