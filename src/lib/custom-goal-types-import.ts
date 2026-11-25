import type { CustomGoalType } from './types';
import { CustomGoalTypeSchema } from './schemas';

/** Parses an exported custom goal types JSON file (or a raw JSON array of CustomGoalType objects) with Zod validation. */
export function parseCustomGoalTypesImport(text: string): CustomGoalType[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).customGoalTypes)
      ? (parsed as Record<string, unknown>).customGoalTypes as unknown[]
      : null;
  if (!list) {
    throw new Error('This file does not contain a list of custom goal types.');
  }
  const valid: CustomGoalType[] = [];
  for (const item of list) {
    const res = CustomGoalTypeSchema.safeParse(item);
    if (res.success) valid.push(res.data);
  }
  if (list.length > 0 && valid.length === 0) {
    throw new Error('None of the custom goal types in this file were valid.');
  }
  return valid;
}
