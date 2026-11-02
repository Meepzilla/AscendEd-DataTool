'use client';

import React, { useMemo, useState } from 'react';
import { PlusCircle, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentData } from '@/hooks/use-student-data';
import { useToast } from '@/hooks/use-toast';
import { GOAL_TYPE_FIELDS, goalDirection } from '@/lib/goal-constants';
import { goalMeasureInfo } from '@/lib/goal-measures';
import { generateUUID, goalTypeLabel } from '@/lib/helpers';
import { classifyGoal, goalDirectionFor, goalName, goalTarget, goalTargetDate, splitGoals } from '@/lib/student-import';
import type { Goal, GoalTemplate, GoalType, Student, TargetDirection } from '@/lib/types';
import { GoalTextPreview, PlaceholderChips } from './PlaceholderChips';

// Writing a custom goal for a student (Assign / Create Goal → Write a custom goal). Only the goal text is needed:
// the name, goal type, target, direction and target date are suggested from its wording (the same reading as the
// student import, student-import.ts) and can each be changed; a field changed by hand stops following the text.
// The target date, baseline and mastery are set here too, and the goal can also be saved as a template.

const GOAL_TYPES = (Object.keys(GOAL_TYPE_FIELDS) as GoalType[]).sort((a, b) => goalTypeLabel(a).localeCompare(goalTypeLabel(b)));
const BEHAVIOR = (type: string) => type.startsWith('BEHAVIOR_');

type Overrides = Partial<{ name: string; type: GoalType; target: string; direction: TargetDirection; targetDate: string }>;

/** What the goal text suggests (the goal, without a label such as "Speech:"), or nothing for an empty text. */
function suggestFromText(text: string, annualReview?: string) {
  const [first] = splitGoals(text);
  if (!first) return null;
  return {
    goalText: first.text,
    name: goalName(first.text),
    type: classifyGoal(first.text, first.area).type,
    targetDate: goalTargetDate(first.text) ?? annualReview ?? '',
  };
}

export default function CustomGoalForm({ student, disabled }: { student: Student; disabled?: boolean }) {
  const { assignGoalToStudent, addGoalTemplate } = useStudentData();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [overrides, setOverrides] = useState<Overrides>({});
  const [baseline, setBaseline] = useState('');
  const [baselineDate, setBaselineDate] = useState('');
  const [mastery, setMastery] = useState('3');
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [saving, setSaving] = useState(false);

  const suggested = useMemo(() => suggestFromText(text, student.iep?.annualReviewDate), [text, student.iep?.annualReviewDate]);
  // Each field: what was entered by hand, else what the text suggests.
  const name = overrides.name ?? suggested?.name ?? '';
  const type: GoalType = overrides.type ?? suggested?.type ?? 'DISCRETE_TRIALS';
  // The target and direction are read for the type in use, so choosing another type re-reads them.
  const target = overrides.target ?? (suggested ? String(goalTarget(type, suggested.goalText)) : '');
  const direction: TargetDirection = overrides.direction ?? (suggested ? goalDirectionFor(type, suggested.goalText) : undefined) ?? goalDirection({ type });
  const targetDate = overrides.targetDate ?? suggested?.targetDate ?? student.iep?.annualReviewDate ?? '';
  const set = (field: keyof Overrides) => (value: string) => setOverrides(prev => ({ ...prev, [field]: value }));
  const fromText = (field: keyof Overrides) => !!suggested && overrides[field] === undefined;

  const info = goalMeasureInfo({ type, targetDirection: direction });
  const targetNumber = target === '' ? undefined : Number(target);
  const targetError = targetNumber === undefined ? null
    : Number.isNaN(targetNumber) || targetNumber < 0 ? 'Enter a number of 0 or more.'
    : info.max !== undefined && targetNumber > info.max ? `The most it can be is ${info.max}.` : null;
  const masteryNumber = Number(mastery);
  const busy = disabled || saving;
  const canSave = !!text.trim() && !!name.trim() && !targetError && masteryNumber >= 1 && masteryNumber <= 20;

  const reset = () => {
    setText(''); setOverrides({}); setBaseline(''); setBaselineDate(''); setMastery('3'); setSaveTemplate(false);
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      let template: GoalTemplate | null = null;
      if (saveTemplate) {
        template = await addGoalTemplate({
          name: name.trim(), type, smartGoalPrompt: text.trim(), generatedSmartGoal: text.trim(), category: 'Custom',
          ...(targetNumber !== undefined ? { sessionTargetValue: targetNumber } : {}),
          ...(BEHAVIOR(type) ? { targetDirection: direction } : {}),
        });
        if (!template) return; // Not saved (the error was shown); the goal isn't added either.
      }
      const goal: Goal = {
        id: generateUUID(),
        name: name.trim(),
        type,
        smartGoal: text.trim(),
        ...(targetNumber !== undefined ? { sessionTargetValue: targetNumber } : {}),
        ...(BEHAVIOR(type) ? { targetDirection: direction } : {}),
        ...(targetDate ? { targetDate } : {}),
        ...(baseline !== '' && !Number.isNaN(Number(baseline)) ? { baseline: Number(baseline) } : {}),
        ...(baselineDate ? { baselineDate } : {}),
        ...(masteryNumber !== 3 ? { masterySessions: masteryNumber } : {}),
        ...(template ? { templateId: template.id } : {}),
      };
      await assignGoalToStudent(student.id, goal);
      toast({ title: 'Goal added', description: `"${goal.name}" was added for ${student.name}${template ? ' and saved as a template' : ''}.` });
      reset();
    } catch {
      toast({ title: 'Error', description: 'The goal couldn\'t be added.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const hint = (field: keyof Overrides) => (fromText(field) ? <span className="ml-1 text-xs font-normal text-muted-foreground">(from the goal text)</span> : null);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="customGoalSmartText">Goal text</Label>
        <Textarea
          id="customGoalSmartText"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type or paste the goal, e.g. By [date], [student] will produce /s/ in words with 80% accuracy in 4 out of 5 opportunities."
          rows={3}
          disabled={busy}
        />
        <PlaceholderChips textareaId="customGoalSmartText" value={text} onChange={setText} disabled={busy} />
        {suggested && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Wand2 className="h-3.5 w-3.5" aria-hidden /> The name, type, target and target date below are filled in from the goal text. Change any that are wrong.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="customGoalName">Goal name{hint('name')}</Label>
          <Input id="customGoalName" value={name} onChange={e => set('name')(e.target.value)} placeholder="e.g. Follow 2-step directions" disabled={busy} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="customGoalType">Goal type (how data is recorded){hint('type')}</Label>
          <Select value={type} onValueChange={v => set('type')(v)} disabled={busy}>
            <SelectTrigger id="customGoalType"><SelectValue /></SelectTrigger>
            <SelectContent>{GOAL_TYPES.map(t => <SelectItem key={t} value={t}>{goalTypeLabel(t)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="customGoalSessionTarget">Target: {info.label.toLowerCase()}{info.unit ? ` (${info.unit.trim()})` : ''}{hint('target')}</Label>
          <Input id="customGoalSessionTarget" type="number" inputMode="decimal" min={0} max={info.max} value={target}
            onChange={e => set('target')(e.target.value)} disabled={busy} aria-invalid={!!targetError} />
          {targetError && <p className="text-xs text-destructive">{targetError}</p>}
        </div>
        {BEHAVIOR(type) && (
          <div className="space-y-1">
            <Label htmlFor="customGoalDirection">Aim to{hint('direction')}</Label>
            <Select value={direction} onValueChange={v => set('direction')(v)} disabled={busy}>
              <SelectTrigger id="customGoalDirection"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="decrease">Decrease (target is the most allowed)</SelectItem>
                <SelectItem value="increase">Increase (target is the least needed)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="customGoalTargetDate">Target date{hint('targetDate')}</Label>
          <Input id="customGoalTargetDate" type="date" value={targetDate} onChange={e => set('targetDate')(e.target.value)} disabled={busy} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="customGoalMastery">Mastery: sessions in a row</Label>
          <Input id="customGoalMastery" type="number" inputMode="numeric" min={1} max={20} value={mastery} onChange={e => setMastery(e.target.value)} disabled={busy} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="customGoalBaseline">Baseline (optional)</Label>
          <Input id="customGoalBaseline" type="number" inputMode="decimal" min={0} value={baseline} onChange={e => setBaseline(e.target.value)}
            placeholder={info.unit === '%' ? 'e.g. 40' : ''} disabled={busy} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="customGoalBaselineDate">Baseline date (optional)</Label>
          <Input id="customGoalBaselineDate" type="date" value={baselineDate} onChange={e => setBaselineDate(e.target.value)} disabled={busy} />
        </div>
      </div>

      <GoalTextPreview studentName={student.name} studentIep={student.iep}
        goal={{ smartGoal: text, type, targetDirection: direction, sessionTargetValue: targetNumber, targetDate: targetDate || undefined,
          masterySessions: masteryNumber || undefined, blankFills: undefined, baseline: baseline === '' ? undefined : Number(baseline), baselineDate: baselineDate || undefined }} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor="customGoalSaveTemplate" className="flex items-center gap-2 text-sm">
          <Checkbox id="customGoalSaveTemplate" checked={saveTemplate} onCheckedChange={v => setSaveTemplate(v === true)} disabled={busy} />
          Also save as a template, to give to other students
        </label>
        <Button type="button" onClick={() => void save()} disabled={!canSave || busy}>
          <PlusCircle className="mr-2 h-4 w-4" aria-hidden />
          {saving ? 'Adding…' : `Add Goal for ${student.name.split(/\s+/)[0]}`}
        </Button>
      </div>
    </div>
  );
}
