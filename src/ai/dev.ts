'use client';
// This file serves as the main entry point for the Genkit AI development environment.
// It loads environment variables and imports all defined Genkit AI flows.

// Load environment variables from a .env file.
// This ensures that API keys and other configurations are available to the Genkit runtime.
import { config } from 'dotenv';
config();

// Import Genkit AI flows.
// These imports register the AI models and functions defined in each flow file
// with the Genkit runtime, making them available for use.
import '@/ai/flows/smart-goal-generation.ts';
import '@/ai/flows/activity-suggestions.ts';
import '@/ai/flows/technical-summary-generation.ts';
import '@/ai/flows/semantic-search-flow.ts';
