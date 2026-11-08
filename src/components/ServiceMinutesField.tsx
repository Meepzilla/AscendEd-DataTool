'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SERVICE_TYPE_LABELS, SERVICE_TYPES, type ServiceType, type SessionData } from '@/lib/types';
import { sessionServiceMinutes } from '@/lib/student-overview';

// Splitting a session's minutes across service types (Related Service, AAC). Without a split the whole
// session counts as Related Service; the editor writes SessionData.serviceMinutes only once the teacher
// chooses to split, so untouched sessions stay in the legacy shape.

interface ServiceMinutesFieldProps {
  /** The session's length from its start and end times; null while either is unset. */
  duration: number | null;
  value: Partial<Record<ServiceType, number>> | undefined;
  onChange: (next: Partial<Record<ServiceType, number>> | undefined) => void;
  /** Keeps input ids unique when several cards are on screen at once. */
  idSuffix?: string;
}

const clampMinutes = (raw: string) => {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.min(600, Math.max(0, n)) : 0;
};

export default function ServiceMinutesField({ duration, value, onChange, idSuffix }: ServiceMinutesFieldProps) {
  if (value === undefined) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm text-muted-foreground">
          {duration !== null
            ? `All ${duration} min count as Related Service`
            : 'Set start and end times to split minutes by type'}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(prefill(duration))}>
          Split by type
        </Button>
      </div>
    );
  }

  const allocated = SERVICE_TYPES.reduce((sum, type) => sum + (value[type] ?? 0), 0);
  const setType = (type: ServiceType, raw: string) => {
    const next: Partial<Record<ServiceType, number>> = { ...value, [type]: clampMinutes(raw) };
    for (const t of SERVICE_TYPES) if (!next[t]) delete next[t];
    onChange(Object.keys(next).length > 0 ? next : undefined);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {SERVICE_TYPES.map(type => (
          <div key={type} className="flex items-center gap-2">
            <Label htmlFor={`service-min-${type}${idSuffix ? `-${idSuffix}` : ''}`} className="whitespace-nowrap">{SERVICE_TYPE_LABELS[type]}</Label>
            <Input
              id={`service-min-${type}${idSuffix ? `-${idSuffix}` : ''}`}
              type="number"
              min={0}
              max={600}
              step={5}
              className="w-24"
              value={value[type] ?? ''}
              onChange={e => setType(type, e.target.value)}
            />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
          Use one type
        </Button>
      </div>
      {duration !== null && (
        <p className={`text-sm ${allocated !== duration ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>
          {allocated} of {duration} min allocated{allocated !== duration ? ' — the split is what counts toward each type' : ''}
        </p>
      )}
    </div>
  );
}

/** The split editor's starting values: the session's current effective allocation. */
function prefill(duration: number | null): Partial<Record<ServiceType, number>> {
  return duration !== null && duration > 0 ? { related: duration } : {};
}

/** Read-only allocation text, e.g. "20 min Related Service · 10 min AAC". Empty when nothing is allocated. */
export function ServiceMinutesSummary({ session }: { session: SessionData }) {
  const allocation = sessionServiceMinutes(session);
  const parts = SERVICE_TYPES
    .filter(type => allocation[type])
    .map(type => `${allocation[type]} min ${SERVICE_TYPE_LABELS[type]}`);
  if (parts.length === 0) return null;
  return <>{parts.join(' · ')}</>;
}
