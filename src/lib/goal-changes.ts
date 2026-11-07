import type { Goal, GoalTemplate, TargetDirection } from '@/lib/types';
import { goalTypeLabel } from '@/lib/helpers';
import { formatGasLevel } from '@/lib/gas';

/** One changed field in a goal editor: its label and the old and new values as shown. */
export interface GoalChange {
  label: string;
  from: string;
  to: string;
}

const NOT_SET = 'Not set';
const BLANK = '(blank)';

/** A form number that may be blank: '' and undefined both mean "not set". */
const toNumber = (v: unknown): number | undefined =>
  v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? undefined : Number(v);

const normText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const formatDate = (v: unknown): string => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return NOT_SET;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTarget = (v: unknown): string => {
  const n = toNumber(v);
  return n === undefined ? 'No target' : String(n);
};

const formatDirection = (v: unknown): string => {
  if (v === 'decrease') return 'Decrease (target is a maximum)';
  if (v === 'increase') return 'Increase (target is a minimum)';
  return 'Default for this goal type';
};

const truncate = (s: string, max = 120): string => (s.length > max ? `${s.slice(0, max)}…` : s);

const textChange = (label: string, from: string, to: string): GoalChange | null =>
  normText(from) === normText(to) ? null : { label, from: truncate(normText(from) || BLANK), to: truncate(normText(to) || BLANK) };

const push = (changes: GoalChange[], change: GoalChange | null) => {
  if (change) changes.push(change);
};

/**
 * What changed between a student's assigned goal and its current editor values, as plain
 * old-to-new lines. Only fields that actually differ are listed, so an untouched editor
 * shows nothing.
 */
export interface AssignedGoalFormValues {
  name?: string;
  smartGoal?: string;
  sessionTargetValue?: number | string;
  targetDate?: string;
  taskSteps?: string | string[];
  baseline?: number | string;
  baselineDate?: string;
  gasLevelDescriptions?: string[];
  masterySessions?: number | string;
  blankFills?: string[];
  targetDirection?: TargetDirection;
  isArchived?: boolean;
  dataCaptureType?: string;
}

export function assignedGoalChanges(original: Goal, values: AssignedGoalFormValues): GoalChange[] {
  // A field left out of `values` counts as unchanged; a field set to '' counts as cleared.
  // The editors always watch every field, so in practice all of them are present.
  const changes: GoalChange[] = [];
  if (values.name !== undefined) push(changes, textChange('Goal name', original.name, values.name));
  if (values.smartGoal !== undefined) push(changes, textChange('Goal text', original.smartGoal, values.smartGoal));

  if (values.dataCaptureType !== undefined) {
    const dataCaptureType = values.dataCaptureType || original.type;
    const originalCapture = original.dataCaptureType ?? original.type;
    if (dataCaptureType !== originalCapture) {
      changes.push({ label: 'Data capture method', from: goalTypeLabel(originalCapture), to: goalTypeLabel(dataCaptureType) });
    }
  }

  if (values.taskSteps !== undefined) {
    const taskSteps = Array.isArray(values.taskSteps) ? values.taskSteps.join('\n') : values.taskSteps;
    const originalSteps = (original.taskSteps ?? []).join('\n');
    if (normText(taskSteps) !== normText(originalSteps)) {
      const fromCount = originalSteps ? originalSteps.split('\n').filter(l => l.trim()).length : 0;
      const toCount = taskSteps ? taskSteps.split('\n').filter(l => l.trim()).length : 0;
      const reworded = fromCount === toCount;
      changes.push({
        label: 'Task steps',
        from: reworded ? `${fromCount} steps (reworded)` : `${fromCount} steps`,
        to: reworded ? `${toCount} steps (reworded)` : `${toCount} steps`,
      });
    }
  }

  if (values.gasLevelDescriptions !== undefined) {
    const originalGas = Array.from({ length: 5 }, (_, i) => original.gasLevelDescriptions?.[i] ?? '');
    values.gasLevelDescriptions.forEach((desc, i) => {
      if (i >= 5) return;
      if (normText(desc) !== normText(originalGas[i])) {
        changes.push({
          label: `Level ${formatGasLevel(i - 2)} description`,
          from: normText(originalGas[i]) || BLANK,
          to: truncate(normText(desc) || BLANK, 80),
        });
      }
    });
  }

  if (values.sessionTargetValue !== undefined && formatTarget(values.sessionTargetValue) !== formatTarget(original.sessionTargetValue)) {
    changes.push({ label: 'Session target', from: formatTarget(original.sessionTargetValue), to: formatTarget(values.sessionTargetValue) });
  }
  if (values.targetDate !== undefined && formatDate(values.targetDate) !== formatDate(original.targetDate)) {
    changes.push({ label: 'Target date', from: formatDate(original.targetDate), to: formatDate(values.targetDate) });
  }
  if (values.baseline !== undefined && formatTarget(values.baseline) !== formatTarget(original.baseline)) {
    changes.push({ label: 'Baseline', from: formatTarget(original.baseline), to: formatTarget(values.baseline) });
  }
  if (values.baselineDate !== undefined && formatDate(values.baselineDate) !== formatDate(original.baselineDate)) {
    changes.push({ label: 'Baseline date', from: formatDate(original.baselineDate), to: formatDate(values.baselineDate) });
  }
  if (values.masterySessions !== undefined && toNumber(values.masterySessions) !== toNumber(original.masterySessions)) {
    const from = toNumber(original.masterySessions);
    const to = toNumber(values.masterySessions);
    changes.push({
      label: 'Mastery: sessions in a row',
      from: from === undefined ? 'Not set (3 by default)' : String(from),
      to: to === undefined ? 'Not set (3 by default)' : String(to),
    });
  }
  if (values.targetDirection !== undefined && formatDirection(values.targetDirection) !== formatDirection(original.targetDirection)) {
    changes.push({ label: 'Goal direction', from: formatDirection(original.targetDirection), to: formatDirection(values.targetDirection) });
  }
  if (values.isArchived !== undefined && !!values.isArchived !== !!original.isArchived) {
    changes.push({ label: 'Archived', from: original.isArchived ? 'Yes' : 'No', to: values.isArchived ? 'Yes' : 'No' });
  }

  if (values.blankFills !== undefined) {
    const originalFills = original.blankFills ?? [];
    const blankCount = Math.max(values.blankFills.length, originalFills.length);
    for (let i = 0; i < blankCount; i += 1) {
      if (normText(values.blankFills[i] ?? '') !== normText(originalFills[i] ?? '')) {
        changes.push({
          label: `Blank ${i + 1} fill`,
          from: truncate(normText(originalFills[i] ?? '') || BLANK, 80),
          to: truncate(normText(values.blankFills[i] ?? '') || BLANK, 80),
        });
      }
    }
  }
  return changes;
}

/** Same old-to-new summary for the goal template editor, which edits the template itself. */
export interface GoalTemplateFormValues {
  name?: string;
  type?: string;
  dataCaptureType?: string;
  smartGoalPrompt?: string;
  generatedSmartGoal?: string;
  sessionTargetValue?: number | string;
  targetDirection?: TargetDirection;
}

export function goalTemplateChanges(original: GoalTemplate, values: GoalTemplateFormValues): GoalChange[] {
  // A field left out of `values` counts as unchanged; a field set to '' counts as cleared.
  const changes: GoalChange[] = [];
  if (values.name !== undefined) push(changes, textChange('Template name', original.name, values.name));
  if (values.smartGoalPrompt !== undefined) push(changes, textChange('Goal description', original.smartGoalPrompt, values.smartGoalPrompt));
  if (values.generatedSmartGoal !== undefined) push(changes, textChange('Final SMART goal', original.generatedSmartGoal, values.generatedSmartGoal));

  if (values.type !== undefined && values.type !== original.type) {
    changes.push({ label: 'Clinical goal category', from: goalTypeLabel(original.type), to: goalTypeLabel(values.type) });
  }
  if (values.dataCaptureType !== undefined) {
    const dataCaptureType = values.dataCaptureType || original.type;
    const originalCapture = original.dataCaptureType ?? original.type;
    if (dataCaptureType !== originalCapture) {
      changes.push({ label: 'Data capture method', from: goalTypeLabel(originalCapture), to: goalTypeLabel(dataCaptureType) });
    }
  }
  if (values.sessionTargetValue !== undefined && formatTarget(values.sessionTargetValue) !== formatTarget(original.sessionTargetValue)) {
    changes.push({ label: 'Session target', from: formatTarget(original.sessionTargetValue), to: formatTarget(values.sessionTargetValue) });
  }
  if (values.targetDirection !== undefined && formatDirection(values.targetDirection) !== formatDirection(original.targetDirection)) {
    changes.push({ label: 'Goal direction', from: formatDirection(original.targetDirection), to: formatDirection(values.targetDirection) });
  }
  return changes;
}
