import type { Goal } from './types';

// Language sample goals: the mean length of utterance (MLU). In a session the clinician records each utterance
// of the sample by its length (in words or in morphemes, set on the goal), and the measure is the average length.
// The session keeps the unit it was counted in, so changing the goal's unit later doesn't change past data.

export type SampleUnit = 'words' | 'morphemes';
export const SAMPLE_UNITS: SampleUnit[] = ['words', 'morphemes'];
/** The longest length that can be recorded for one utterance. */
export const MAX_UTTERANCE_LENGTH = 50;
/** Length buttons shown in Data Entry; longer utterances are typed in. */
export const UTTERANCE_BUTTONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** The most utterances one session's sample can hold. */
export const MAX_UTTERANCES = 500;

/** The goal's unit: words unless the goal says morphemes. */
export function sampleUnit(goal: Pick<Goal, 'sampleUnit'> | null | undefined): SampleUnit {
  return goal?.sampleUnit === 'morphemes' ? 'morphemes' : 'words';
}

/** The unit a session was counted in (stored on the session), falling back to the goal's. */
export function sessionSampleUnit(data: Record<string, any> | undefined, goal?: Pick<Goal, 'sampleUnit'>): SampleUnit {
  if (data?.unit === 'morphemes' || data?.unit === 'words') return data.unit;
  return sampleUnit(goal);
}

/** A session's utterance lengths: whole numbers from 1 to MAX_UTTERANCE_LENGTH (anything else is left out). */
export function utteranceLengths(data: Record<string, any> | undefined): number[] {
  const raw = Array.isArray(data?.utterances) ? data!.utterances : [];
  return raw
    .map((n: unknown) => Number(n))
    .filter((n: number) => Number.isInteger(n) && n >= 1 && n <= MAX_UTTERANCE_LENGTH)
    .slice(0, MAX_UTTERANCES);
}

export interface SampleSummary {
  utterances: number;
  total: number;
  /** Mean length of utterance, or null with no utterances. */
  mlu: number | null;
  longest: number;
}

export function summarizeSample(lengths: number[]): SampleSummary {
  const total = lengths.reduce((sum, n) => sum + n, 0);
  return {
    utterances: lengths.length,
    total,
    mlu: lengths.length ? total / lengths.length : null,
    longest: lengths.length ? Math.max(...lengths) : 0,
  };
}

export function languageSampleSummary(data: Record<string, any> | undefined): SampleSummary {
  return summarizeSample(utteranceLengths(data));
}

/** Adds an utterance of the given length (ignored when out of range or the sample is full). */
export function addUtterance(data: Record<string, any>, length: number, unit: SampleUnit): Record<string, any> {
  const n = Math.round(Number(length));
  const current = utteranceLengths(data);
  if (!Number.isInteger(n) || n < 1 || n > MAX_UTTERANCE_LENGTH || current.length >= MAX_UTTERANCES) return data;
  return { ...data, unit: data.unit === 'words' || data.unit === 'morphemes' ? data.unit : unit, utterances: [...current, n] };
}

/** Removes the utterance at an index (the last one when no index is given). */
export function removeUtterance(data: Record<string, any>, index?: number): Record<string, any> {
  const current = utteranceLengths(data);
  if (current.length === 0) return data;
  const at = index === undefined ? current.length - 1 : index;
  if (at < 0 || at >= current.length) return data;
  return { ...data, utterances: current.filter((_, i) => i !== at) };
}

/** "3.4 words", "1 morpheme". */
export function formatSampleLength(value: number, unit: SampleUnit): string {
  const v = Math.round(value * 100) / 100;
  const word = unit === 'morphemes' ? 'morpheme' : 'word';
  return `${v} ${word}${v === 1 ? '' : 's'}`;
}

/** How many utterances of each length, for lengths 1 through `cap` (the last row holds `cap` and longer). */
export function lengthDistribution(lengths: number[], cap = 10): { length: number; label: string; count: number }[] {
  const rows = Array.from({ length: cap }, (_, i) => ({ length: i + 1, label: i + 1 === cap ? `${cap}+` : String(i + 1), count: 0 }));
  for (const n of lengths) rows[Math.min(n, cap) - 1].count++;
  return rows;
}
