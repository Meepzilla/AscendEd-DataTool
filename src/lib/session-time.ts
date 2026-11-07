// Default session times for Data Entry: starting now and lasting DEFAULT_SESSION_MINUTES.
// Time inputs need 24-hour "HH:mm".

export const DEFAULT_SESSION_MINUTES = 30;

export function toTimeInputValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function defaultSessionTimes(now = new Date()): { start: string; end: string } {
  const startMinutes = now.getHours() * 60 + now.getMinutes();
  // The end is a time of day, not a date: past midnight it would read earlier than the start, so it is
  // clamped to 23:59 rather than rolling over to 00:20.
  const endMinutes = Math.min(23 * 60 + 59, startMinutes + DEFAULT_SESSION_MINUTES);
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return { start: fmt(startMinutes), end: fmt(endMinutes) };
}
