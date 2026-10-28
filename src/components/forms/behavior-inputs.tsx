'use client';

import React, { useEffect, useState } from 'react';
import { Play, Square, Undo2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import TallyButton from './TallyButton';
import {
  ABC_ANTECEDENTS, ABC_BEHAVIORS, ABC_CONSEQUENCES, ABC_REPLACEMENT_BEHAVIOR,
  summarizeFrequency, summarizeDuration, summarizeAbc, formatSeconds, type AbcIncident,
} from '@/lib/goal-constants';

// Data entry for the behavior goal types. `update` merges fields into the goal's session data;
// `interact` runs a change unless the goal is archived or the student access lock is on.
interface BehaviorInputProps {
  data: Record<string, any>;
  update: (fields: Record<string, any>) => void;
  interact: (e: React.SyntheticEvent<HTMLButtonElement>, change: () => void) => void;
  disabled?: boolean;
  isLocked?: boolean;
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-0.5">
    <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
    {children}
  </div>
);

const Summary: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="mt-1.5">
    <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
    <p className="text-sm font-semibold text-primary">{children}</p>
  </div>
);

const ObservationMinutes: React.FC<BehaviorInputProps & { hint: string }> = ({ data, update, disabled, isLocked, hint }) => (
  <Field label={`Observation Time (minutes, optional) ${hint}`}>
    <Input
      type="number"
      min="0"
      inputMode="decimal"
      value={data.observationMinutes ?? ''}
      onChange={(e) => update({ observationMinutes: e.target.value })}
      placeholder="e.g., 30"
      className="h-8 text-sm w-28"
      disabled={disabled || isLocked}
    />
  </Field>
);

const Notes: React.FC<BehaviorInputProps & { placeholder: string }> = ({ data, update, disabled, isLocked, placeholder }) => (
  <Field label="Notes">
    <Textarea
      value={data.notes || ''}
      onChange={(e) => update({ notes: e.target.value })}
      placeholder={placeholder}
      rows={1}
      className="text-sm"
      disabled={disabled || isLocked}
    />
  </Field>
);

export const FrequencyInput: React.FC<BehaviorInputProps> = (props) => {
  const { data, update, interact, disabled } = props;
  const { count, ratePerHour } = summarizeFrequency(data);
  return (
    <>
      <Field label="Occurrences">
        <TallyButton
          label="Count"
          count={count}
          title="Behavior occurrences"
          className="h-12 min-w-[8rem] text-base"
          disabled={disabled}
          onIncrement={(e) => interact(e, () => update({ count: count + 1 }))}
          onDecrement={(e) => interact(e, () => update({ count: Math.max(0, count - 1) }))}
        />
        <p className="text-[11px] text-muted-foreground">Tap each time the behavior occurs. Press and hold (or right-click) to remove one.</p>
      </Field>
      <ObservationMinutes {...props} hint="for a rate per hour" />
      <Summary label="Frequency">
        {count} {count === 1 ? 'occurrence' : 'occurrences'}
        {ratePerHour !== null && ` · ${ratePerHour.toFixed(1)} per hour`}
      </Summary>
      <Notes {...props} placeholder="e.g., setting, intensity, what helped" />
    </>
  );
};

export const DurationInput: React.FC<BehaviorInputProps> = (props) => {
  const { data, update, interact, disabled, isLocked } = props;
  const [, setTick] = useState(0);
  const [manualMinutes, setManualMinutes] = useState('');
  const summary = summarizeDuration(data);

  // Re-render every second while the timer runs; the elapsed time comes from runningSince, so it stays
  // correct while the device is locked or the app is in the background.
  useEffect(() => {
    if (!summary.running) return;
    const id = window.setInterval(() => setTick(t => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [summary.running]);

  const episodes: number[] = summary.episodes;
  const start = () => update({ runningSince: Date.now() });
  const stop = () => update({ episodeSeconds: [...episodes, summary.runningSeconds], runningSince: null });
  const addManual = () => {
    const minutes = Number(manualMinutes);
    if (minutes > 0) {
      update({ episodeSeconds: [...episodes, Math.round(minutes * 60)] });
      setManualMinutes('');
    }
  };

  return (
    <>
      <Field label="Episode Timer">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            className={cn('h-12 min-w-[8rem] text-base touch-manipulation', summary.running && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
            onClick={(e) => interact(e, summary.running ? stop : start)}
            disabled={disabled}
          >
            {summary.running ? <><Square className="mr-2 h-4 w-4" /> Stop {formatSeconds(summary.runningSeconds)}</> : <><Play className="mr-2 h-4 w-4" /> Start</>}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            title="Remove the last episode"
            onClick={(e) => interact(e, () => update({ episodeSeconds: episodes.slice(0, -1) }))}
            disabled={disabled || episodes.length === 0}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Start when the behavior begins and stop when it ends. Saving the session stops a running timer.</p>
      </Field>
      {episodes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {episodes.map((seconds, i) => (
            <span key={i} className="rounded border px-1.5 py-0.5 text-xs">#{i + 1} {formatSeconds(seconds)}</span>
          ))}
        </div>
      )}
      <Field label="Add an Episode by Hand (minutes)">
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min="0"
            inputMode="decimal"
            value={manualMinutes}
            onChange={(e) => setManualMinutes(e.target.value)}
            placeholder="e.g., 2.5"
            className="h-8 text-sm w-24"
            disabled={disabled || isLocked}
          />
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={(e) => interact(e, addManual)} disabled={disabled || !(Number(manualMinutes) > 0)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </Field>
      <ObservationMinutes {...props} hint="for % of time" />
      <Summary label="Duration">
        {formatSeconds(summary.totalSeconds)} total ({summary.totalMinutes.toFixed(1)} min) · {summary.episodeCount} {summary.episodeCount === 1 ? 'episode' : 'episodes'}
        {summary.episodeCount > 0 && ` · longest ${formatSeconds(summary.longestSeconds)}`}
        {summary.percentOfObservation !== null && ` · ${summary.percentOfObservation.toFixed(0)}% of observation`}
      </Summary>
      <Notes {...props} placeholder="e.g., what ended the episode" />
    </>
  );
};

const ChipGroup: React.FC<{ label: string; options: readonly string[]; value: string; onSelect: (v: string) => void; disabled?: boolean; highlight?: string }> =
  ({ label, options, value, onSelect, disabled, highlight }) => (
    <Field label={label}>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
        {options.map(option => (
          <Button
            key={option}
            type="button"
            size="sm"
            role="radio"
            aria-checked={value === option}
            variant={value === option ? 'default' : 'outline'}
            className={cn('h-7 px-2 text-xs touch-manipulation', option === highlight && value !== option && 'border-green-600 text-green-700 dark:text-green-400')}
            onClick={() => onSelect(value === option ? '' : option)}
            disabled={disabled}
          >
            {option}
          </Button>
        ))}
      </div>
    </Field>
  );

export const AbcInput: React.FC<BehaviorInputProps> = (props) => {
  const { data, update, interact, disabled, isLocked } = props;
  const [antecedent, setAntecedent] = useState('');
  const [behavior, setBehavior] = useState('');
  const [consequence, setConsequence] = useState('');
  const [note, setNote] = useState('');
  const summary = summarizeAbc(data);
  const incidents: AbcIncident[] = summary.incidents;

  const addIncident = () => {
    const incident: AbcIncident = { time: new Date().toISOString(), antecedent, behavior, consequence, ...(note.trim() ? { note: note.trim() } : {}) };
    update({ incidents: [...incidents, incident], incidentCount: incidents.length + 1 });
    setAntecedent(''); setBehavior(''); setConsequence(''); setNote('');
  };
  const removeIncident = (index: number) => {
    const next = incidents.filter((_, i) => i !== index);
    update({ incidents: next, incidentCount: next.length });
  };

  return (
    <>
      <ChipGroup label="A: Antecedent (what happened before)" options={ABC_ANTECEDENTS} value={antecedent} onSelect={setAntecedent} disabled={disabled || isLocked} />
      <ChipGroup label="B: Behavior" options={ABC_BEHAVIORS} value={behavior} onSelect={setBehavior} disabled={disabled || isLocked} highlight={ABC_REPLACEMENT_BEHAVIOR} />
      <ChipGroup label="C: Consequence (what happened after)" options={ABC_CONSEQUENCES.map(c => c.label)} value={consequence} onSelect={setConsequence} disabled={disabled || isLocked} />
      <div className="flex items-center gap-1">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-8 text-sm" disabled={disabled || isLocked} />
        <Button type="button" size="sm" className="h-8 shrink-0" onClick={(e) => interact(e, addIncident)} disabled={disabled || !behavior}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Incident
        </Button>
      </div>
      {incidents.length > 0 && (
        <ol className="space-y-1 text-xs">
          {incidents.map((incident, i) => (
            <li key={i} className="flex items-start gap-1 rounded border p-1">
              <span className="text-muted-foreground shrink-0">{new Date(incident.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
              <span className="flex-grow">
                {[incident.antecedent || '?', incident.behavior, incident.consequence || '?'].join(' → ')}
                {incident.note && <span className="text-muted-foreground"> · {incident.note}</span>}
              </span>
              <Button type="button" variant="ghost" size="icon" className="h-5 w-5 shrink-0" title="Remove incident"
                onClick={(e) => interact(e, () => removeIncident(i))} disabled={disabled}>
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <Summary label="ABC Summary">
        {summary.incidentCount} {summary.incidentCount === 1 ? 'incident' : 'incidents'} ({summary.problemCount} problem behavior, {summary.replacementCount} replacement skill)
        {summary.replacementPercent !== null && ` · replacement ${summary.replacementPercent.toFixed(0)}%`}
      </Summary>
      {(summary.antecedents.length > 0 || summary.functions.length > 0) && (
        <p className="text-xs text-muted-foreground">
          {summary.antecedents.length > 0 && <>Most common antecedent: {summary.antecedents[0][0]} ({summary.antecedents[0][1]}). </>}
          {summary.functions.length > 0 && <>Possible function: {summary.functions.map(([fn, n]) => `${fn} ${n}`).join(', ')}.</>}
        </p>
      )}
      <Notes {...props} placeholder="e.g., setting, staff present" />
    </>
  );
};
