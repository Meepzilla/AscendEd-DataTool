// How much each session's accuracy counts, by its number of opportunities (correct + incorrect + approximate
// responses). A session with 1 response out of 1 is 100%, the same as 5 out of 5, but it says much less about
// the student, so the Progress Over Time chart draws it smaller and hollow, its weighted trend pools trials
// across sessions, and the Progress Report's trend line weights each session by its opportunities.

import { goalResponses } from './goal-measures';

/** Below this many opportunities a session is drawn as a hollow dot: too few trials to read much into. */
export const FEW_OPPORTUNITIES = 5;

/** Sessions (days with trial data) pooled for the chart's weighted trend line. */
export const POOLED_TREND_SESSIONS = 3;

/** A session's opportunities for a trial-based goal, or null for goals measured another way. */
export function opportunitiesOf(type: string, data: Record<string, any>): number | null {
  const responses = goalResponses(type, data);
  if (!responses) return null;
  return (responses.correct ?? 0) + (responses.incorrect ?? 0) + (responses.approximate ?? 0);
}

/**
 * A session's weight in the report's trend line: its opportunities for a trial-based goal, so a 1-of-1 session
 * counts a fifth as much as a 5-of-5 one; 1 for every other kind of goal (each session counts the same).
 */
export function trendWeight(type: string, data: Record<string, any>): number {
  const opportunities = opportunitiesOf(type, data);
  return opportunities === null ? 1 : Math.max(opportunities, 0);
}

/**
 * Accuracy pooled over the last `sessions` points that have trials, ending at each point: total correct over
 * total opportunities, so a point with many trials counts for more than one with few. Null where no point so
 * far has any trials.
 */
export function pooledAccuracy(points: { correct: number; opportunities: number }[], sessions = POOLED_TREND_SESSIONS): (number | null)[] {
  const withTrials: { correct: number; opportunities: number }[] = [];
  return points.map(point => {
    if (point.opportunities > 0) withTrials.push(point);
    const window = withTrials.slice(-sessions);
    const opportunities = window.reduce((sum, p) => sum + p.opportunities, 0);
    if (opportunities === 0) return null;
    const correct = window.reduce((sum, p) => sum + p.correct, 0);
    return Math.round((correct / opportunities) * 1000) / 10;
  });
}

/** A chart dot's radius in pixels for a session's opportunities: 1 → about 4.5, 5 → 6.4, 20 or more → 9. */
export function dotRadius(opportunities: number): number {
  return Math.min(9, 3 + 1.5 * Math.sqrt(Math.max(opportunities, 1)));
}
