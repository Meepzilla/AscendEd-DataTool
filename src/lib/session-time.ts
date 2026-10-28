// Default session times for Data Entry: starting now and lasting DEFAULT_SESSION_MINUTES.
// Time inputs need 24-hour "HH:mm".

export const DEFAULT_SESSION_MINUTES = 30;

export function toTimeInputValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function defaultSessionTimes(now = new Date()): { start: string; end: string } {
  const end = new Date(now.getTime() + DEFAULT_SESSION_MINUTES * 60_000);
  return { start: toTimeInputValue(now), end: toTimeInputValue(end) };
}
