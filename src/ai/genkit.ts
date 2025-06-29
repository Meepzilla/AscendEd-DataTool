// This file configures the Genkit AI environment for the application.

// Import the main Genkit library.
import {genkit} from 'genkit';
// Import the Google AI plugin for Genkit, allowing access to Google's generative AI models.
import {googleAI} from '@genkit-ai/googleai';

// Initialize and configure the Genkit AI instance.
export const ai = genkit({
  // Define the plugins to be used with Genkit.
  // In this case, the Google AI plugin is used to integrate with Google's models.
  plugins: [googleAI()],
  // Specify the default AI model to be used for operations if not explicitly overridden.
  // 'googleai/gemini-2.0-flash' is a lightweight and fast model.
  model: 'googleai/gemini-2.0-flash',
});
