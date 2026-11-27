'use client';

import React from 'react';
import { commFunctionsBySession, type CommFunctionUses } from '@/lib/goal-constants';

// Communication Functions goals: which functions the student used in each session, as a table with a row per
// function and a column per session. Each cell shows that session's spontaneous (S), emerging (E) and prompted (P)
// uses of the function, so a specific day's functions can be read at a glance.

/** How many session columns the table shows (the most recent ones). */
export const COMM_TABLE_SESSIONS = 12;

const FORMS: { key: keyof CommFunctionUses; letter: string; label: string; color: string }[] = [
  { key: 'spontaneous', letter: 'S', label: 'spontaneous', color: 'hsl(var(--comm-spontaneous))' },
  { key: 'emerging', letter: 'E', label: 'emerging', color: 'hsl(var(--comm-emerging))' },
  { key: 'prompted', letter: 'P', label: 'prompted', color: 'hsl(var(--comm-prompted))' },
];

/** "2 spontaneous, 1 prompted", or "not used". */
export function describeUses(uses: CommFunctionUses): string {
  const parts = FORMS.filter(f => uses[f.key] > 0).map(f => `${uses[f.key]} ${f.label}`);
  return parts.length ? parts.join(', ') : 'not used';
}

const Uses: React.FC<{ uses: CommFunctionUses }> = ({ uses }) => {
  const shown = FORMS.filter(f => uses[f.key] > 0);
  if (!shown.length) return <><span className="text-muted-foreground" aria-hidden="true">·</span><span className="sr-only">not used</span></>;
  return (
    <span className="inline-flex flex-wrap justify-center gap-x-1.5 gap-y-0.5">
      <span className="sr-only">{describeUses(uses)}</span>
      {shown.map(f => (
        <span key={f.key} className="inline-flex items-center gap-0.5 whitespace-nowrap tabular-nums" aria-hidden="true">
          <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: f.color }} />
          {f.letter}{uses[f.key]}
        </span>
      ))}
    </span>
  );
};

export function CommFunctionsBySession({ recorded }: { recorded: { data: Record<string, any>; label: string }[] }) {
  const firstColumn = Math.max(0, recorded.length - COMM_TABLE_SESSIONS);
  const columns = recorded.slice(firstColumn);
  const rows = commFunctionsBySession(columns.map(r => r.data));
  if (!rows.length) return null;
  const hasEmerging = rows.some(r => r.total.emerging > 0);

  return (
    <div className="md:col-span-3">
      <p className="mb-1 text-sm font-medium">Functions by session</p>
      {firstColumn > 0 && (
        <p className="mb-1 text-xs text-muted-foreground">
          The last {COMM_TABLE_SESSIONS} sessions. Narrow the date range to see earlier ones.
        </p>
      )}
      {/* Scrolls sideways on a phone: focusable so it can be scrolled from the keyboard too. */}
      <div className="relative overflow-x-auto rounded-md border" tabIndex={0} role="region" aria-label="Functions by session">
        <table className="w-full text-xs">
          <caption className="sr-only">
            The communication functions used in each session, with spontaneous, {hasEmerging ? 'emerging, ' : ''}and prompted uses
            {firstColumn > 0 ? `; the last ${COMM_TABLE_SESSIONS} sessions` : ''}.
          </caption>
          <thead className="bg-muted/40">
            <tr>
              <th scope="col" className="px-2 py-1 text-left font-medium">Function</th>
              {columns.map((c, i) => <th key={i} scope="col" className="px-1 py-1 text-center font-medium whitespace-nowrap">{c.label}</th>)}
              <th scope="col" className="px-2 py-1 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key} className="border-t">
                <th scope="row" className="px-2 py-1 text-left font-medium">
                  {row.label}
                  {row.hidden && <span className="sr-only"> (no longer in the list)</span>}
                </th>
                {row.sessions.map((uses, i) => (
                  <td key={i} className="px-1 py-1 text-center align-middle">
                    <Uses uses={uses} />
                  </td>
                ))}
                <td className="px-2 py-1 text-right">
                  {/* rows are computed over the visible columns, so row.total matches the visible cells. */}
                  <Uses uses={row.total} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        {FORMS.filter(f => f.key !== 'emerging' || hasEmerging).map(f => (
          <span key={f.key} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: f.color }} aria-hidden="true" />
            {f.letter} = {f.label}
          </span>
        ))}
        <span>· = not used that session</span>
      </p>
    </div>
  );
}
