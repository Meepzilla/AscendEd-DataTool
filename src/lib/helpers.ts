
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  if (!date) return 'Invalid Date';
  let d: Date;
  if (typeof date === 'string') {
    d = new Date(date);
  } else {
    d = date;
  }
  
  if (isNaN(d.getTime())) return 'Invalid Date';

  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(date: Date | string): string {
   let d: Date;
  if (typeof date === 'string') {
    d = new Date(date);
  } else {
    d = date;
  }
   if (isNaN(d.getTime())) return '';

  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * A goal's session target as shown to the user: a percentage for most goal types, a 1-5 rating for
 * qualitative observations, a number of different functions for communication functions, and for
 * behavior goals a count, minutes, % or seconds with "≤" (decrease goals, the default) or "≥" (increase goals).
 */
export function formatGoalTarget(type: string, target: number, direction?: 'increase' | 'decrease'): string {
  if (type.startsWith('BEHAVIOR_')) {
    const sign = (direction ?? 'decrease') === 'decrease' ? '≤' : '≥';
    if (type === 'BEHAVIOR_FREQUENCY') return `${sign} ${target} per session`;
    if (type === 'BEHAVIOR_DURATION') return `${sign} ${target} min`;
    if (type === 'BEHAVIOR_INTERVAL') return `${sign} ${target}% of intervals`;
    if (type === 'BEHAVIOR_LATENCY') return `${sign} ${target} s average`;
    return direction === 'increase' ? `≥ ${target}% replacement skill` : `≤ ${plural(target, 'incident')}`;
  }
  if (type === 'COMMUNICATION_FUNCTIONS') return plural(target, 'function');
  // Observation and cognitive goals are rated 1-5.
  if (type.startsWith('QUALITATIVE') || type === 'COGNITIVE') return `${target} out of 5`;
  return `${target}%`;
}

/** Whether every word of `search` appears in a goal template's name, goal text or skill area. */
export function templateMatchesSearch(template: { name: string; generatedSmartGoal?: string; category?: string }, search: string): boolean {
  const text = `${template.name} ${template.generatedSmartGoal || ''} ${template.category || ''}`.toLowerCase();
  return search.toLowerCase().split(/\s+/).filter(Boolean).every(word => text.includes(word));
}

// Template pickers render at most this many matches; the goal bank has over 1,000 templates.
export const TEMPLATE_PICKER_LIMIT = 100;

/**
 * A stored goal data value as readable text: lists are joined, ABC incidents read
 * "time: antecedent → behavior → consequence", interval records read "+ − ·", other objects as "key: value" pairs.
 */
export function formatDataValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    if (value.some(item => typeof item === 'boolean') && value.every(item => typeof item === 'boolean' || item === null)) {
      return value.map(item => (item === true ? '+' : item === false ? '−' : '·')).join(' ');
    }
    return value.map(item => {
      if (item && typeof item === 'object' && 'behavior' in item) {
        const i = item as { time?: string; antecedent?: string; behavior?: string; consequence?: string; note?: string };
        const time = i.time ? new Date(i.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ': ' : '';
        return `${time}${[i.antecedent || '?', i.behavior, i.consequence || '?'].join(' → ')}${i.note ? ` (${i.note})` : ''}`;
      }
      return formatDataValue(item);
    }).join('; ');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}: ${formatDataValue(v)}`).join(', ');
  }
  return String(value);
}

/** A goal type as shown to the user, e.g. "Behavior Frequency", "AAC", "Behavior ABC". */
export function goalTypeLabel(type: string): string {
  return type.split('_').map(word => (word === 'AAC' || word === 'ABC') ? word : word.charAt(0) + word.slice(1).toLowerCase()).join(' ');
}

/** "1 student", "2 students". */
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function studentProfilePath(studentId: string): string {
  return `/student-profile/view?id=${encodeURIComponent(studentId)}`;
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Add more helper functions as needed, e.g., for data transformation, validation, etc.

/**
 * Delays execution for a specified number of milliseconds.
 * @param ms The number of milliseconds to wait.
 * @returns A promise that resolves after the delay.
 */
export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getAppIdFromGlobals(): string | null {
   if (typeof window !== 'undefined' && (window as any).__app_id) {
    return (window as any).__app_id;
  }
  return null;
}

export function getInitialAuthTokenFromGlobals(): string | null {
  if (typeof window !== 'undefined' && (window as any).__initial_auth_token) {
    return (window as any).__initial_auth_token;
  }
  return null;
}

/**
 * When a session started, for ordering: its day at its start time when one was entered (Data Entry stamps
 * every session saved from one sitting with the same date, so two sessions on a day differ only by time).
 */
export function sessionTimestamp(session: { date: string; time?: string }): number {
  const date = new Date(session.date);
  const match = /^(\d{1,2}):(\d{2})/.exec(session.time || '');
  if (Number.isNaN(date.getTime()) || !match) return date.getTime();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(match[1]), Number(match[2])).getTime();
}

/** Orders sessions oldest first (by sessionTimestamp, then the stored date). */
export function compareSessionsOldestFirst(a: { date: string; time?: string }, b: { date: string; time?: string }): number {
  return sessionTimestamp(a) - sessionTimestamp(b) || new Date(a.date).getTime() - new Date(b.date).getTime();
}
