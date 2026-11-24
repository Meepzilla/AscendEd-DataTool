import type { Goal, PromptType, SessionData, TrialStatus } from './types';
import {
  captureTypeOf, summarizeCommunicationFunctions, summarizeLatency, toolTypeOf,
} from './goal-constants';
import { fillNameBlanks } from './goal-blanks';
import {
  goalMeasure, goalNotes, goalResponses, meetsTarget, promptTotals, sessionMeetsTarget,
  usesPromptCounters, withoutRunningTimers,
} from './goal-measures';
import { formatDate, goalTypeLabel, parseDateOnly } from './helpers';
import { PROMPT_ABBREVIATIONS, PROMPT_COLORS, PROMPT_TYPES } from './promptConstants';
import { aimValueAt, type AimLine } from './aim-line';
import { pooledAccuracy } from './trial-weights';
import type { TimeGrouping } from './report-filters';

const round = (n: number) => Math.round(n * 10) / 10;

export const PROMPT_DISPLAY_LABELS: Record<PromptType, string> = {
  Independent: 'Independent',
  Visual: 'Visual',
  Verbal: 'Verbal',
  Gestural: 'Gestural',
  PartialPhysical: 'Partial physical',
  Imitation: 'Imitation',
};

export interface RecordedGoalSession {
  session: SessionData;
  data: Record<string, any>;
  value: number;
  label: string;
  date: Date;
}

/**
 * Sessions where something was recorded for `goal`, oldest first.
 * With `includeUnansweredLatency`, latency sessions with trials but no completed response time are included with `value: NaN`.
 */
export function collectRecordedGoalSessions(
  goal: Goal,
  sessions: SessionData[],
  includeUnansweredLatency = false,
): RecordedGoalSession[] {
  const matched: Omit<RecordedGoalSession, 'label'>[] = [];
  for (const session of sessions) {
    const stored = (session.goals ?? []).find(g => g.goalId === goal.id)?.data;
    if (!stored) continue;
    const data = withoutRunningTimers(stored);
    let value = goalMeasure(goal, data);
    if (value === null && includeUnansweredLatency && toolTypeOf(captureTypeOf(goal)) === 'BEHAVIOR_LATENCY' && summarizeLatency(data).trialCount > 0) {
      value = Number.NaN;
    }
    if (value === null) continue;
    matched.push({
      session,
      data,
      value: Number.isNaN(value) ? Number.NaN : round(value),
      date: parseDateOnly(session.date),
    });
  }

  const years = new Set(matched.map(m => m.date.getFullYear()).filter(Number.isFinite));
  const showYear = years.size > 1;
  const seen: Record<string, number> = {};
  return matched.map(item => {
    const valid = !Number.isNaN(item.date.getTime());
    const dayKey = valid ? `${item.date.getFullYear()}-${item.date.getMonth()}-${item.date.getDate()}` : String(item.session.date);
    const day = valid
      ? item.date.toLocaleDateString('en-US', showYear ? { month: 'short', day: 'numeric', year: '2-digit' } : { month: 'short', day: 'numeric' })
      : String(item.session.date);
    seen[dayKey] = (seen[dayKey] || 0) + 1;
    return { ...item, label: seen[dayKey] > 1 ? `${day} (${seen[dayKey]})` : day };
  });
}

interface BucketMeta {
  key: string;
  sortKey: number;
  label: string;
  fullLabel: string;
}

/** Computes a local-calendar week (Sunday start) or month bucket key and readable labels. */
export function bucketMetaForDate(date: Date, rawFallback: string, grouping: Exclude<TimeGrouping, 'session'>, showYear: boolean): BucketMeta {
  if (Number.isNaN(date.getTime())) {
    return { key: rawFallback, sortKey: 0, label: rawFallback, fullLabel: rawFallback };
  }
  if (grouping === 'week') {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    start.setDate(start.getDate() - start.getDay());
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const shortDay = start.toLocaleDateString('en-US', showYear ? { month: 'short', day: 'numeric', year: '2-digit' } : { month: 'short', day: 'numeric' });
    const longDay = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return {
      key,
      sortKey: start.getTime(),
      label: `Wk of ${shortDay}`,
      fullLabel: `Week of ${longDay}`,
    };
  }
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const key = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
  const label = monthStart.toLocaleDateString('en-US', showYear ? { month: 'short', year: '2-digit' } : { month: 'short' });
  const fullLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return { key, sortKey: monthStart.getTime(), label, fullLabel };
}

function compactPromptSummary(totals: Record<string, number>): string {
  const parts = PROMPT_TYPES
    .filter(pt => (totals[pt] ?? 0) > 0)
    .map(pt => `${PROMPT_ABBREVIATIONS[pt]} ${totals[pt]}`);
  return parts.join(', ');
}

export interface GoalChartPoint {
  label: string;
  fullLabel: string;
  value: number;
  sessionCount: number;
  metCount: number;
  metTarget: boolean | null;
  correct?: number;
  approximate?: number;
  incorrect?: number;
  opportunities?: number;
  spontaneousFunctions?: number;
  emergingFunctions?: number;
  spontaneousUses?: number;
  emergingUses?: number;
  promptedUses?: number;
  aim?: number;
  promptsSummary: string;
  notes: string;
}

/**
 * Aggregates a goal's recorded sessions by `'session'`, `'week'`, or `'month'` for Line, Bar, and Table views.
 */
export function groupGoalPoints(
  goal: Goal,
  recorded: RecordedGoalSession[],
  grouping: TimeGrouping,
  aim: AimLine | null,
): GoalChartPoint[] {
  const validRecorded = recorded.filter(r => !Number.isNaN(r.value));
  if (validRecorded.length === 0) return [];

  const type = captureTypeOf(goal);
  const isCommFunctions = type === 'COMMUNICATION_FUNCTIONS';
  const hasResp = goalResponses(goal) !== null;
  const target = goal.sessionTargetValue;

  if (grouping === 'session') {
    const seenDates: Record<string, number> = {};
    return validRecorded.map(r => {
      const resp = hasResp ? goalResponses(goal, r.data) : null;
      const comm = isCommFunctions ? summarizeCommunicationFunctions(r.data) : null;
      const met = target !== undefined ? sessionMeetsTarget(goal, r.data, target) : null;
      const baseFull = formatDate(r.session.date);
      seenDates[baseFull] = (seenDates[baseFull] || 0) + 1;
      const fullLabel = seenDates[baseFull] > 1 ? `${baseFull} (${seenDates[baseFull]})` : baseFull;
      const opportunities = resp ? resp.correct + resp.approximate + resp.incorrect : undefined;
      return {
        label: r.label,
        fullLabel,
        value: r.value,
        sessionCount: 1,
        metCount: met ? 1 : 0,
        metTarget: met,
        ...(resp ? { ...resp, opportunities } : {}),
        ...(comm ? {
          spontaneousFunctions: comm.functionsUsedSpontaneously,
          emergingFunctions: comm.functionsUsedEmergingOnly,
          spontaneousUses: comm.spontaneous,
          emergingUses: comm.emerging,
          promptedUses: comm.prompted,
        } : {}),
        ...(aim ? { aim: round(aimValueAt(aim, r.session.date)) } : {}),
        promptsSummary: usesPromptCounters(goal) ? compactPromptSummary(promptTotals(r.data)) : '',
        notes: goalNotes(r.data),
      };
    });
  }

  const years = new Set(validRecorded.map(r => r.date.getFullYear()).filter(Number.isFinite));
  const showYear = years.size > 1;
  const buckets = new Map<string, { meta: BucketMeta; items: RecordedGoalSession[] }>();

  for (const r of validRecorded) {
    const meta = bucketMetaForDate(r.date, r.label, grouping, showYear);
    const existing = buckets.get(meta.key);
    if (existing) existing.items.push(r);
    else buckets.set(meta.key, { meta, items: [r] });
  }

  return [...buckets.values()]
    .sort((a, b) => a.meta.sortKey - b.meta.sortKey)
    .map(({ meta, items }) => {
      const avgValue = round(items.reduce((sum, r) => sum + r.value, 0) / items.length);
      const metCount = target !== undefined ? items.filter(r => sessionMeetsTarget(goal, r.data, target)).length : 0;
      const metTarget = target !== undefined ? meetsTarget(goal, avgValue, target) : null;

      let correct = 0;
      let approximate = 0;
      let incorrect = 0;
      let spontaneousFunctionsSum = 0;
      let emergingFunctionsSum = 0;
      let spontaneousUses = 0;
      let emergingUses = 0;
      let promptedUses = 0;
      const aggPrompts = promptTotals();
      const noteEntries: string[] = [];

      for (const r of items) {
        if (hasResp) {
          const resp = goalResponses(goal, r.data);
          if (resp) {
            correct += resp.correct;
            approximate += resp.approximate;
            incorrect += resp.incorrect;
          }
        }
        if (isCommFunctions) {
          const comm = summarizeCommunicationFunctions(r.data);
          spontaneousFunctionsSum += comm.functionsUsedSpontaneously;
          emergingFunctionsSum += comm.functionsUsedEmergingOnly;
          spontaneousUses += comm.spontaneous;
          emergingUses += comm.emerging;
          promptedUses += comm.prompted;
        }
        if (usesPromptCounters(goal)) {
          const pt = promptTotals(r.data);
          for (const k of Object.keys(pt)) aggPrompts[k] = (aggPrompts[k] || 0) + pt[k];
        }
        const text = goalNotes(r.data);
        if (text) noteEntries.push(items.length > 1 ? `${r.label}: ${text}` : text);
      }

      const lastSessionDate = items[items.length - 1].session.date;
      const opportunities = hasResp ? correct + approximate + incorrect : undefined;

      return {
        label: meta.label,
        fullLabel: meta.fullLabel,
        value: avgValue,
        sessionCount: items.length,
        metCount,
        metTarget,
        ...(hasResp ? { correct, approximate, incorrect, opportunities } : {}),
        ...(isCommFunctions ? {
          spontaneousFunctions: round(spontaneousFunctionsSum / items.length),
          emergingFunctions: round(emergingFunctionsSum / items.length),
          spontaneousUses,
          emergingUses,
          promptedUses,
        } : {}),
        ...(aim ? { aim: round(aimValueAt(aim, lastSessionDate)) } : {}),
        promptsSummary: usesPromptCounters(goal) ? compactPromptSummary(aggPrompts) : '',
        notes: noteEntries.slice(-3).join(' · '),
      };
    });
}

export interface CombinedChartRow {
  date: string;
  fullLabel: string;
  sessionCount: number;
  accuracy: number | null;
  weightedTrend: number | null;
  correct: number;
  incorrect: number;
  approximate: number;
  opportunities: number;
  totalPrompts: number;
  totalPromptTallies: number;
  independenceRate: number | null;
  Independent: number;
  Visual: number;
  Verbal: number;
  Gestural: number;
  PartialPhysical: number;
  Imitation: number;
  totalSyllables: number;
  stutteredSyllables: number;
  fluencyPct: number | null;
  blocks: number;
  repetitions: number;
  prolongations: number;
  interjections: number;
}

/**
 * Transforms student sessions into time-series points grouped by session, week, or month
 * for overall accuracy, response counts, prompt fading, and fluency charts.
 */
export function buildCombinedChartSeries(
  sessions: SessionData[],
  studentGoals: Goal[],
  grouping: TimeGrouping = 'session',
  selectedGoalId?: string,
): CombinedChartRow[] {
  interface ParsedSessionEntry {
    session: SessionData;
    when: Date;
    goalsRecorded: number;
    correct: number;
    incorrect: number;
    approximate: number;
    promptCounts: Record<PromptType, number>;
    totalSyllables: number;
    stutteredSyllables: number;
    blocks: number;
    repetitions: number;
    prolongations: number;
    interjections: number;
  }

  const entries: ParsedSessionEntry[] = [];

  for (const session of sessions) {
    const when = parseDateOnly(session.date);
    if (Number.isNaN(when.getTime())) continue;

    let goalsRecorded = 0;
    let correct = 0;
    let incorrect = 0;
    let approximate = 0;
    const promptCounts: Record<PromptType, number> = {
      Independent: 0,
      Visual: 0,
      Verbal: 0,
      Gestural: 0,
      PartialPhysical: 0,
      Imitation: 0,
    };
    let totalSyllables = 0;
    let stutteredSyllables = 0;
    let blocks = 0;
    let repetitions = 0;
    let prolongations = 0;
    let interjections = 0;

    for (const goalData of session.goals ?? []) {
      const currentGoal = studentGoals.find(g => g.id === goalData.goalId);
      if (!currentGoal || currentGoal.isArchived) continue;
      if (selectedGoalId && goalData.goalId !== selectedGoalId) continue;

      const data = withoutRunningTimers(goalData.data || {});
      const type = captureTypeOf(currentGoal);

      let promptTallyForGoal = 0;
      for (const pt of PROMPT_TYPES) {
        const val = Math.max(0, Number(data[pt]) || 0);
        promptCounts[pt] += val;
        promptTallyForGoal += val;
      }

      if (goalMeasure(currentGoal, data) !== null || promptTallyForGoal > 0) {
        goalsRecorded += 1;
      }

      if (type === 'FLUENCY_SYLLABLE_STUTTER') {
        totalSyllables += Math.max(0, Number(data.totalSyllables) || 0);
        stutteredSyllables += Math.max(0, Number(data.stutteredSyllables) || 0);
        blocks += Math.max(0, Number(data.blocks) || 0);
        repetitions += Math.max(0, Number(data.repetitions) || 0);
        prolongations += Math.max(0, Number(data.prolongations) || 0);
        interjections += Math.max(0, Number(data.interjections) || 0);
      }

      const responses = goalResponses(currentGoal, data);
      if (responses) {
        correct += responses.correct;
        incorrect += responses.incorrect;
        approximate += responses.approximate;
      }
    }

    if (goalsRecorded > 0) {
      entries.push({
        session,
        when,
        goalsRecorded,
        correct,
        incorrect,
        approximate,
        promptCounts,
        totalSyllables,
        stutteredSyllables,
        blocks,
        repetitions,
        prolongations,
        interjections,
      });
    }
  }

  if (entries.length === 0) return [];

  const showYear = new Set(entries.map(e => e.when.getFullYear())).size > 1;

  interface RawBucket {
    sortKey: number;
    label: string;
    fullLabel: string;
    items: ParsedSessionEntry[];
  }

  const buckets: RawBucket[] = [];

  if (grouping === 'session') {
    const seenDay: Record<string, number> = {};
    for (const e of entries) {
      const dayKey = `${e.when.getFullYear()}-${e.when.getMonth()}-${e.when.getDate()}`;
      const base = e.when.toLocaleDateString('en-US', showYear ? { month: 'short', day: 'numeric', year: '2-digit' } : { month: 'short', day: 'numeric' });
      const baseFull = formatDate(e.session.date);
      seenDay[dayKey] = (seenDay[dayKey] || 0) + 1;
      const suffix = seenDay[dayKey] > 1 ? ` (${seenDay[dayKey]})` : '';
      buckets.push({
        sortKey: e.when.getTime(),
        label: `${base}${suffix}`,
        fullLabel: `${baseFull}${suffix}`,
        items: [e],
      });
    }
  } else {
    const map = new Map<string, RawBucket>();
    for (const e of entries) {
      const meta = bucketMetaForDate(e.when, e.session.date, grouping, showYear);
      const existing = map.get(meta.key);
      if (existing) existing.items.push(e);
      else map.set(meta.key, { sortKey: meta.sortKey, label: meta.label, fullLabel: meta.fullLabel, items: [e] });
    }
    buckets.push(...[...map.values()].sort((a, b) => a.sortKey - b.sortKey));
  }

  const rows = buckets.map(bucket => {
    const promptCounts: Record<PromptType, number> = {
      Independent: 0,
      Visual: 0,
      Verbal: 0,
      Gestural: 0,
      PartialPhysical: 0,
      Imitation: 0,
    };
    let correct = 0;
    let incorrect = 0;
    let approximate = 0;
    let totalSyllables = 0;
    let stutteredSyllables = 0;
    let blocks = 0;
    let repetitions = 0;
    let prolongations = 0;
    let interjections = 0;

    for (const item of bucket.items) {
      correct += item.correct;
      incorrect += item.incorrect;
      approximate += item.approximate;
      for (const pt of PROMPT_TYPES) promptCounts[pt] += item.promptCounts[pt];
      totalSyllables += item.totalSyllables;
      stutteredSyllables += item.stutteredSyllables;
      blocks += item.blocks;
      repetitions += item.repetitions;
      prolongations += item.prolongations;
      interjections += item.interjections;
    }

    const opportunities = correct + incorrect + approximate;
    const accuracy = opportunities > 0 ? round((correct / opportunities) * 100) : null;
    const totalPrompts = PROMPT_TYPES.reduce((sum, pt) => (pt === 'Independent' ? sum : sum + promptCounts[pt]), 0);
    const totalPromptTallies = totalPrompts + promptCounts.Independent;
    const independenceRate = totalPromptTallies > 0 ? round((promptCounts.Independent / totalPromptTallies) * 100) : null;
    const fluencyPct = totalSyllables > 0 ? round((Math.max(0, totalSyllables - stutteredSyllables) / totalSyllables) * 100) : null;

    return {
      date: bucket.label,
      fullLabel: bucket.fullLabel,
      sessionCount: bucket.items.length,
      accuracy,
      weightedTrend: null as number | null,
      correct,
      incorrect,
      approximate,
      opportunities,
      totalPrompts,
      totalPromptTallies,
      independenceRate,
      ...promptCounts,
      totalSyllables,
      stutteredSyllables,
      fluencyPct,
      blocks,
      repetitions,
      prolongations,
      interjections,
    };
  });

  const weighted = pooledAccuracy(rows.map(r => ({ correct: r.correct, opportunities: r.opportunities })));
  return rows.map((row, idx) => ({ ...row, weightedTrend: weighted[idx] }));
}

export interface PromptLevelStat {
  key: PromptType;
  label: string;
  count: number;
  /** Share of all tallied responses (including Independent). */
  sharePct: number;
  /** Share among non-Independent prompts only. */
  promptSharePct: number;
  color: string;
  isIndependent: boolean;
}

export interface PromptSessionBin {
  name: string;
  label: string;
  count: number;
}

export interface PromptSummary {
  levels: PromptLevelStat[];
  totalIndependent: number;
  totalPrompted: number;
  totalTallied: number;
  independenceRate: number | null;
  mostUsedPrompt: { key: PromptType; label: string; count: number } | null;
  promptCapableGoalCount: number;
  sessionsWithPromptGoals: number;
  unpromptedSessions: number;
  sessionBins: PromptSessionBin[];
}

/**
 * Consolidates prompt usage by level and by per-session intensity across active goals in view.
 */
export function buildPromptSummary(
  sessions: SessionData[],
  studentGoals: Goal[],
  selectedGoalId?: string,
): PromptSummary {
  const activeGoals = studentGoals.filter(g => !g.isArchived && (!selectedGoalId || g.id === selectedGoalId));
  const promptCapableGoals = activeGoals.filter(g => usesPromptCounters(g));
  const counts: Record<PromptType, number> = {
    Independent: 0,
    Visual: 0,
    Verbal: 0,
    Gestural: 0,
    PartialPhysical: 0,
    Imitation: 0,
  };

  const binCounts = {
    zero: 0,
    oneToFive: 0,
    sixToTen: 0,
    elevenToFifteen: 0,
    sixteenPlus: 0,
  };
  let sessionsWithPromptGoals = 0;

  for (const session of sessions) {
    let sessionHadPromptGoalRecorded = false;
    let sessionPromptTotal = 0;

    for (const goalEntry of session.goals ?? []) {
      const goal = activeGoals.find(g => g.id === goalEntry.goalId);
      if (!goal) continue;
      const data = withoutRunningTimers(goalEntry.data || {});

      let entryPromptSum = 0;
      for (const pt of PROMPT_TYPES) {
        const val = Math.max(0, Number(data[pt]) || 0);
        counts[pt] += val;
        if (pt !== 'Independent') {
          sessionPromptTotal += val;
        }
        entryPromptSum += val;
      }

      if (usesPromptCounters(goal) && (goalMeasure(goal, data) !== null || entryPromptSum > 0)) {
        sessionHadPromptGoalRecorded = true;
      }
    }

    if (sessionHadPromptGoalRecorded) {
      sessionsWithPromptGoals += 1;
      if (sessionPromptTotal === 0) binCounts.zero += 1;
      else if (sessionPromptTotal <= 5) binCounts.oneToFive += 1;
      else if (sessionPromptTotal <= 10) binCounts.sixToTen += 1;
      else if (sessionPromptTotal <= 15) binCounts.elevenToFifteen += 1;
      else binCounts.sixteenPlus += 1;
    }
  }

  const totalIndependent = counts.Independent;
  const totalPrompted = PROMPT_TYPES.reduce((sum, pt) => (pt === 'Independent' ? sum : sum + counts[pt]), 0);
  const totalTallied = totalIndependent + totalPrompted;
  const independenceRate = totalTallied > 0 ? round((totalIndependent / totalTallied) * 100) : null;

  const levels: PromptLevelStat[] = PROMPT_TYPES.map(pt => {
    const count = counts[pt];
    return {
      key: pt,
      label: PROMPT_DISPLAY_LABELS[pt],
      count,
      sharePct: totalTallied > 0 ? round((count / totalTallied) * 100) : 0,
      promptSharePct: pt !== 'Independent' && totalPrompted > 0 ? round((count / totalPrompted) * 100) : 0,
      color: PROMPT_COLORS[pt],
      isIndependent: pt === 'Independent',
    };
  });

  const nonIndependentWithCounts = levels
    .filter(l => !l.isIndependent && l.count > 0)
    .sort((a, b) => b.count - a.count);
  const mostUsedPrompt = nonIndependentWithCounts[0]
    ? { key: nonIndependentWithCounts[0].key, label: nonIndependentWithCounts[0].label, count: nonIndependentWithCounts[0].count }
    : null;

  const sessionBins: PromptSessionBin[] = [
    { name: '0 prompts', label: '0 prompts (Independent)', count: binCounts.zero },
    { name: '1–5', label: '1–5 prompts', count: binCounts.oneToFive },
    { name: '6–10', label: '6–10 prompts', count: binCounts.sixToTen },
    { name: '11–15', label: '11–15 prompts', count: binCounts.elevenToFifteen },
    { name: '16+', label: '16+ prompts', count: binCounts.sixteenPlus },
  ];

  return {
    levels,
    totalIndependent,
    totalPrompted,
    totalTallied,
    independenceRate,
    mostUsedPrompt,
    promptCapableGoalCount: promptCapableGoals.length,
    sessionsWithPromptGoals,
    unpromptedSessions: binCounts.zero,
    sessionBins,
  };
}

export interface GoalOutcomeRow {
  goalId: string;
  goalName: string;
  typeLabel: string;
  sessionCount: number;
  correct: number;
  approximate: number;
  incorrect: number;
  opportunities: number;
  correctPct: number;
  approximatePct: number;
  incorrectPct: number;
  target: number | null;
}

/**
 * Side-by-side response breakdown per active trial-based goal (replaces the Sankey flow diagram).
 */
export function buildGoalOutcomeComparison(
  sessions: SessionData[],
  studentGoals: Goal[],
  selectedGoalId?: string,
): GoalOutcomeRow[] {
  const goals = studentGoals.filter(g => !g.isArchived && (!selectedGoalId || g.id === selectedGoalId));
  const rows: GoalOutcomeRow[] = [];

  for (const goal of goals) {
    if (goalResponses(goal) === null) continue;
    let correct = 0;
    let approximate = 0;
    let incorrect = 0;
    let sessionCount = 0;

    for (const session of sessions) {
      const entry = (session.goals ?? []).find(g => g.goalId === goal.id);
      if (!entry?.data) continue;
      const resp = goalResponses(goal, withoutRunningTimers(entry.data));
      if (!resp) continue;
      const opps = resp.correct + resp.approximate + resp.incorrect;
      if (opps === 0) continue;
      correct += resp.correct;
      approximate += resp.approximate;
      incorrect += resp.incorrect;
      sessionCount += 1;
    }

    const opportunities = correct + approximate + incorrect;
    if (opportunities === 0) continue;

    rows.push({
      goalId: goal.id,
      goalName: fillNameBlanks(goal),
      typeLabel: goalTypeLabel(goal),
      sessionCount,
      correct,
      approximate,
      incorrect,
      opportunities,
      correctPct: round((correct / opportunities) * 100),
      approximatePct: round((approximate / opportunities) * 100),
      incorrectPct: round((incorrect / opportunities) * 100),
      target: goal.sessionTargetValue ?? null,
    });
  }

  return rows;
}

export type ScoredTrialStatus = Exclude<TrialStatus, 'untouched'>;

export interface GoalTrialSessionSequence {
  sessionId: string;
  dateLabel: string;
  fullDate: string;
  trials: ScoredTrialStatus[];
  correct: number;
  approximate: number;
  incorrect: number;
  total: number;
  accuracyPct: number;
}

export interface GoalTrialSequenceGroup {
  goalId: string;
  goalName: string;
  typeLabel: string;
  totalTrials: number;
  overallAccuracyPct: number;
  firstHalfAccuracyPct: number | null;
  secondHalfAccuracyPct: number | null;
  sessions: GoalTrialSessionSequence[];
}

function isTrialGridOrSequencedGoal(goal: Goal): boolean {
  const cap = captureTypeOf(goal);
  if (cap === 'CUSTOM') return goal.customType?.kind === 'trials';
  const tool = toolTypeOf(cap);
  return tool === 'DISCRETE_TRIALS' || tool === 'SEQUENCED_TRIALS';
}

/**
 * Extracts trial-by-trial sequences grouped by goal (rather than pooling trials across unrelated goals),
 * plus first-half vs. second-half accuracy to help spot warm-up errors or end-of-session fatigue.
 */
export function buildGoalTrialSequences(
  sessions: SessionData[],
  studentGoals: Goal[],
  selectedGoalId?: string,
): GoalTrialSequenceGroup[] {
  const goals = studentGoals.filter(g => !g.isArchived && (!selectedGoalId || g.id === selectedGoalId) && isTrialGridOrSequencedGoal(g));
  if (goals.length === 0 || sessions.length === 0) return [];

  const parsedDates = sessions.map(s => parseDateOnly(s.date));
  const showYear = new Set(parsedDates.map(d => d.getFullYear()).filter(Number.isFinite)).size > 1;

  const groups: GoalTrialSequenceGroup[] = [];

  for (const goal of goals) {
    const tool = toolTypeOf(captureTypeOf(goal));
    const goalSessions: GoalTrialSessionSequence[] = [];
    const seenDay: Record<string, number> = {};
    let totalCorrect = 0;
    let totalTrials = 0;
    let firstHalfCorrect = 0;
    let firstHalfTotal = 0;
    let secondHalfCorrect = 0;
    let secondHalfTotal = 0;

    sessions.forEach((session, idx) => {
      const entry = (session.goals ?? []).find(g => g.goalId === goal.id);
      if (!entry?.data) return;

      const rawTrials: TrialStatus[] = [];
      const hasTouchedGrid = Array.isArray(entry.data.trials) && entry.data.trials.some((t: TrialStatus) => t !== 'untouched');
      if (hasTouchedGrid) {
        rawTrials.push(...entry.data.trials);
      } else if (tool === 'SEQUENCED_TRIALS') {
        const successful = Math.max(0, Number(entry.data.successfulAttempts) || 0);
        const approximate = Math.max(0, Number(entry.data.approximate) || 0);
        const failed = Math.max(0, Number(entry.data.failedAttempts) || 0);
        for (let i = 0; i < successful; i++) rawTrials.push('correct');
        for (let i = 0; i < approximate; i++) rawTrials.push('approximate');
        for (let i = 0; i < failed; i++) rawTrials.push('incorrect');
      }

      const trials = rawTrials.filter((t): t is ScoredTrialStatus => t === 'correct' || t === 'approximate' || t === 'incorrect');
      if (trials.length === 0) return;

      const d = parsedDates[idx];
      const valid = !Number.isNaN(d.getTime());
      const dayKey = valid ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : String(session.date);
      const baseLabel = valid
        ? d.toLocaleDateString('en-US', showYear ? { month: 'short', day: 'numeric', year: '2-digit' } : { month: 'short', day: 'numeric' })
        : String(session.date);
      seenDay[dayKey] = (seenDay[dayKey] || 0) + 1;
      const suffix = seenDay[dayKey] > 1 ? ` (${seenDay[dayKey]})` : '';

      const correct = trials.filter(t => t === 'correct').length;
      const approximate = trials.filter(t => t === 'approximate').length;
      const incorrect = trials.filter(t => t === 'incorrect').length;
      const total = trials.length;

      totalCorrect += correct;
      totalTrials += total;

      // Within-session split when at least 4 trials were run in sequence on a trial grid
      if (hasTouchedGrid && total >= 4) {
        const mid = Math.floor(total / 2);
        const firstSlice = trials.slice(0, mid);
        const secondSlice = trials.slice(mid);
        firstHalfCorrect += firstSlice.filter(t => t === 'correct').length;
        firstHalfTotal += firstSlice.length;
        secondHalfCorrect += secondSlice.filter(t => t === 'correct').length;
        secondHalfTotal += secondSlice.length;
      }

      goalSessions.push({
        sessionId: session.sessionId,
        dateLabel: `${baseLabel}${suffix}`,
        fullDate: `${formatDate(session.date)}${suffix}`,
        trials,
        correct,
        approximate,
        incorrect,
        total,
        accuracyPct: round((correct / total) * 100),
      });
    });

    if (goalSessions.length === 0) continue;

    groups.push({
      goalId: goal.id,
      goalName: fillNameBlanks(goal),
      typeLabel: goalTypeLabel(goal),
      totalTrials,
      overallAccuracyPct: round((totalCorrect / totalTrials) * 100),
      firstHalfAccuracyPct: firstHalfTotal > 0 ? round((firstHalfCorrect / firstHalfTotal) * 100) : null,
      secondHalfAccuracyPct: secondHalfTotal > 0 ? round((secondHalfCorrect / secondHalfTotal) * 100) : null,
      sessions: goalSessions,
    });
  }

  return groups;
}
