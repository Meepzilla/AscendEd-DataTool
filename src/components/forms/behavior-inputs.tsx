'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, Undo2, Plus, X, Check, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import TallyButton from './TallyButton';
import {
  ABC_REPLACEMENT_BEHAVIOR, INTERVAL_METHODS, INTERVAL_LENGTHS_SECONDS, MAX_INTERVALS,
  summarizeFrequency, summarizeDuration, summarizeAbc, summarizeIntervals, summarizeLatency,
  formatSeconds, formatLatency, type AbcIncident, type IntervalSetup,
} from '@/lib/goal-constants';
import { useAbcLists } from '@/hooks/use-abc-lists';

// Data entry for the behavior goal types. `update` merges fields into the goal's session data;
// `interact` runs a change unless the goal is archived or the student access lock is on.
interface BehaviorInputProps {
  data: Record<string, any>;
  update: (fields: Record<string, any>) => void;
  interact: (e: React.SyntheticEvent<HTMLButtonElement>, change: () => void) => void;
  disabled?: boolean;
  isLocked?: boolean;
  goalId?: string;
}

/** Re-renders every `ms` while `active`, for timers that compute elapsed time from a start timestamp. */
function useTicker(active: boolean, ms = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick(t => t + 1), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
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
  const [manualMinutes, setManualMinutes] = useState('');
  const summary = summarizeDuration(data);

  // The elapsed time comes from runningSince, so it stays correct while the device is locked or the app
  // is in the background.
  useTicker(summary.running);

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
  const lists = useAbcLists();
  const [antecedent, setAntecedent] = useState('');
  const [behavior, setBehavior] = useState('');
  const [consequence, setConsequence] = useState('');
  const [note, setNote] = useState('');
  const summary = summarizeAbc(data);
  const incidents: AbcIncident[] = summary.incidents;

  const addIncident = () => {
    const fn = lists.consequences.find(c => c.label === consequence)?.fn ?? null;
    const incident: AbcIncident = { time: new Date().toISOString(), antecedent, behavior, consequence, fn, ...(note.trim() ? { note: note.trim() } : {}) };
    update({ incidents: [...incidents, incident], incidentCount: incidents.length + 1 });
    setAntecedent(''); setBehavior(''); setConsequence(''); setNote('');
  };
  const removeIncident = (index: number) => {
    const next = incidents.filter((_, i) => i !== index);
    update({ incidents: next, incidentCount: next.length });
  };

  return (
    <>
      <ChipGroup label="A: Antecedent (what happened before)" options={lists.antecedents} value={antecedent} onSelect={setAntecedent} disabled={disabled || isLocked} />
      <ChipGroup label="B: Behavior" options={[ABC_REPLACEMENT_BEHAVIOR, ...lists.behaviors]} value={behavior} onSelect={setBehavior} disabled={disabled || isLocked} highlight={ABC_REPLACEMENT_BEHAVIOR} />
      <ChipGroup label="C: Consequence (what happened after)" options={lists.consequences.map(c => c.label)} value={consequence} onSelect={setConsequence} disabled={disabled || isLocked} />
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

// The interval setup last used for each goal on this device, so it doesn't have to be chosen every session.
const INTERVAL_SETUPS_KEY = 'ascended_interval_setups';
const INTERVAL_CUE_KEY = 'ascended_interval_cue';

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
function writeStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: the setting just isn't remembered.
  }
}

/** A short beep and a vibration (where supported) at the end of each interval. */
function useIntervalCue() {
  const audioRef = useRef<AudioContext | null>(null);
  // The audio context has to be created by a tap (iPad), so this is called when the timer is started.
  const prepare = () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioRef.current && Ctx) audioRef.current = new Ctx();
      void audioRef.current?.resume();
    } catch {
      audioRef.current = null;
    }
  };
  const cue = () => {
    navigator.vibrate?.(200);
    const ctx = audioRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  };
  return { prepare, cue };
}

export const IntervalInput: React.FC<BehaviorInputProps> = (props) => {
  const { data, update, interact, disabled, isLocked, goalId } = props;
  const [remembered, setRemembered] = useState<Partial<IntervalSetup>>({});
  const [cueOn, setCueOn] = useState(false);
  const { prepare, cue } = useIntervalCue();

  useEffect(() => {
    if (goalId) setRemembered(readStored<Record<string, IntervalSetup>>(INTERVAL_SETUPS_KEY, {})[goalId] ?? {});
    setCueOn(readStored(INTERVAL_CUE_KEY, false));
  }, [goalId]);

  const summary = summarizeIntervals(data, Date.now(), remembered);
  const { method, intervalSeconds, intervalCount } = summary;
  useTicker(summary.running, 250);

  // Cue when the timer moves into the next interval, and when the last one ends (not when it's stopped).
  const lastIntervalRef = useRef<number | null>(summary.currentInterval);
  useEffect(() => {
    const previous = lastIntervalRef.current;
    lastIntervalRef.current = summary.currentInterval;
    if (cueOn && summary.timerStarted && previous !== null && previous !== summary.currentInterval) cue();
  });

  const setupFields = { method, intervalSeconds, intervalCount };
  const changeSetup = (fields: Partial<IntervalSetup>) => {
    const next = { ...setupFields, ...fields };
    if (goalId) writeStored(INTERVAL_SETUPS_KEY, { ...readStored(INTERVAL_SETUPS_KEY, {}), [goalId]: next });
    setRemembered(next);
    update({ ...next, intervals: summary.intervals.slice(0, next.intervalCount) });
  };
  // Every change also stores the setup in use, so the saved session records it.
  const markInterval = (index: number, value: boolean | null) => {
    const intervals = Array.from({ length: Math.max(summary.intervals.length, index + 1) }, (_, i) => summary.intervals[i] ?? null);
    intervals[index] = value;
    update({ ...setupFields, intervals });
  };
  const cycle = (value: boolean | null) => (value === null ? true : value === true ? false : null);

  const setupLocked = disabled || isLocked || summary.running;
  const methodInfo = INTERVAL_METHODS.find(m => m.value === method)!;

  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Method">
          <Select value={method} onValueChange={(v) => changeSetup({ method: v as IntervalSetup['method'] })} disabled={setupLocked}>
            <SelectTrigger className="h-8 text-sm w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INTERVAL_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Interval">
          <Select value={String(intervalSeconds)} onValueChange={(v) => changeSetup({ intervalSeconds: Number(v) })} disabled={setupLocked}>
            <SelectTrigger className="h-8 text-sm w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from(new Set([...INTERVAL_LENGTHS_SECONDS, intervalSeconds])).sort((a, b) => a - b).map(seconds => (
                <SelectItem key={seconds} value={String(seconds)}>{seconds < 60 ? `${seconds} s` : `${seconds / 60} min`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Intervals">
          <Input
            type="number"
            min="1"
            max={MAX_INTERVALS}
            inputMode="numeric"
            value={intervalCount}
            onChange={(e) => {
              const count = Math.round(Number(e.target.value));
              if (count >= 1 && count <= MAX_INTERVALS) changeSetup({ intervalCount: count });
            }}
            className="h-8 text-sm w-20"
            disabled={setupLocked}
          />
        </Field>
      </div>
      <p className="text-[11px] text-muted-foreground">{methodInfo.hint} Observation: {formatSeconds(intervalSeconds * intervalCount)}.</p>

      <Field label="Interval Timer">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className={cn('h-10 min-w-[8rem] touch-manipulation', summary.running && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
            onClick={(e) => interact(e, () => {
              if (summary.running) return update({ ...setupFields, timerStartedAt: null });
              prepare();
              update({ ...setupFields, timerStartedAt: Date.now() });
            })}
            disabled={disabled}
          >
            {summary.running ? <><Square className="mr-2 h-4 w-4" /> Stop</> : <><Play className="mr-2 h-4 w-4" /> {summary.timerStarted ? 'Restart' : 'Start'} Timer</>}
          </Button>
          <span className="text-sm font-medium" aria-live="polite">
            {summary.running
              ? `Interval ${summary.currentInterval! + 1} of ${intervalCount} · ${formatSeconds(summary.secondsLeftInInterval!)} left`
              : summary.timerStarted ? 'Observation complete' : ''}
          </span>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
            <Switch
              checked={cueOn}
              onCheckedChange={(on) => { setCueOn(on); writeStored(INTERVAL_CUE_KEY, on); if (on) prepare(); }}
              aria-label="Beep at each interval"
            />
            Beep at each interval
          </label>
        </div>
      </Field>

      <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Intervals">
        {Array.from({ length: intervalCount }, (_, i) => {
          const value = summary.intervals[i] ?? null;
          return (
            <Button
              key={i}
              type="button"
              variant="outline"
              className={cn(
                'h-11 p-0 flex flex-col gap-0 touch-manipulation',
                value === true && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                value === false && 'bg-muted text-muted-foreground',
                summary.currentInterval === i && 'ring-2 ring-amber-500 ring-offset-1',
              )}
              title={`Interval ${i + 1}: tap to mark + (behavior), again for − (not seen), again to clear`}
              aria-label={`Interval ${i + 1}: ${value === true ? 'behavior seen' : value === false ? 'not seen' : 'not scored'}`}
              onClick={(e) => interact(e, () => markInterval(i, cycle(value)))}
              disabled={disabled}
            >
              <span className="text-[10px] leading-none opacity-70">{i + 1}</span>
              <span className="text-lg leading-none font-bold">{value === true ? '+' : value === false ? '−' : ''}</span>
            </Button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">Tap an interval for + (behavior seen), again for − (not seen), again to clear.</p>
      <Summary label="Interval Summary">
        {summary.scored === 0
          ? 'No intervals scored yet'
          : `+ in ${summary.occurred} of ${summary.scored} scored intervals (${summary.percent!.toFixed(0)}%)`}
      </Summary>
      <Notes {...props} placeholder="e.g., activity, setting, behavior definition" />
    </>
  );
};

export const LatencyInput: React.FC<BehaviorInputProps> = (props) => {
  const { data, update, interact, disabled, isLocked } = props;
  const [manualSeconds, setManualSeconds] = useState('');
  const summary = summarizeLatency(data);
  useTicker(summary.timing, 100);

  const record = (seconds: number | null) =>
    update({ latencies: [...summary.latencies, seconds === null ? null : Math.round(seconds * 10) / 10], cueGivenAt: null });
  const addManual = () => {
    const seconds = Number(manualSeconds);
    if (seconds >= 0 && manualSeconds !== '') {
      record(seconds);
      setManualSeconds('');
    }
  };

  return (
    <>
      <Field label="Latency Timer">
        {summary.timing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="h-12 min-w-[9rem] text-base touch-manipulation bg-green-600 text-white hover:bg-green-700"
              onClick={(e) => interact(e, () => record(summary.timingSeconds))}
              disabled={disabled}
            >
              <Check className="mr-2 h-4 w-4" /> Responded {formatLatency(summary.timingSeconds)}
            </Button>
            <Button type="button" variant="outline" className="h-12 touch-manipulation" onClick={(e) => interact(e, () => record(null))} disabled={disabled}>
              <Ban className="mr-2 h-4 w-4" /> No Response
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8" title="Cancel this trial without recording it"
              onClick={(e) => interact(e, () => update({ cueGivenAt: null }))} disabled={disabled}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="h-12 min-w-[9rem] text-base touch-manipulation"
              onClick={(e) => interact(e, () => update({ cueGivenAt: Date.now() }))}
              disabled={disabled}
            >
              <Play className="mr-2 h-4 w-4" /> Cue Given
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              title="Remove the last trial"
              onClick={(e) => interact(e, () => update({ latencies: summary.latencies.slice(0, -1) }))}
              disabled={disabled || summary.trialCount === 0}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Tap Cue Given when you give the direction, then Responded when the student starts to respond.</p>
      </Field>
      {summary.trialCount > 0 && (
        <div className="flex flex-wrap gap-1">
          {summary.latencies.map((seconds, i) => (
            <span key={i} className={cn('rounded border px-1.5 py-0.5 text-xs', seconds === null && 'text-muted-foreground')}>
              #{i + 1} {seconds === null ? 'no response' : formatLatency(seconds)}
            </span>
          ))}
        </div>
      )}
      <Field label="Add a Trial by Hand (seconds)">
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min="0"
            inputMode="decimal"
            value={manualSeconds}
            onChange={(e) => setManualSeconds(e.target.value)}
            placeholder="e.g., 12"
            className="h-8 text-sm w-24"
            disabled={disabled || isLocked}
          />
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={(e) => interact(e, addManual)} disabled={disabled || manualSeconds === '' || !(Number(manualSeconds) >= 0)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </Field>
      <Summary label="Latency">
        {summary.averageSeconds === null
          ? `${summary.trialCount} ${summary.trialCount === 1 ? 'trial' : 'trials'}${summary.noResponseCount ? `, ${summary.noResponseCount} with no response` : ''}`
          : <>
              Average {formatLatency(summary.averageSeconds)} · median {formatLatency(summary.medianSeconds!)} · range {formatLatency(summary.shortestSeconds!)}–{formatLatency(summary.longestSeconds!)}
              {` · ${summary.trialCount} ${summary.trialCount === 1 ? 'trial' : 'trials'}`}
              {summary.noResponseCount > 0 && `, ${summary.noResponseCount} with no response`}
            </>}
      </Summary>
      <Notes {...props} placeholder="e.g., type of direction, supports given" />
    </>
  );
};
