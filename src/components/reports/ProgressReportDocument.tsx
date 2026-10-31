import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { APP_NAME } from '@/lib/appConstants';
import { formatDate, plural } from '@/lib/helpers';
import { PROGRESS_STATUS_LABELS, type GoalProgress, type ProgressStatus } from '@/lib/report-narrative';
import { cn } from '@/lib/utils';
import ProgressReportChart from './ProgressReportChart';

// The progress report page itself: a header with the student and period, a summary table of every goal, then
// a section per goal (statement, figures, status, chart, comments). The same component draws the on-screen
// preview (editable: status and comments) and the printed copy.

export interface ProgressReportSettings {
  preparedBy: string;
  showCharts: boolean;
  showNextSteps: boolean;
}

export interface ProgressReportEdits {
  status: Record<string, ProgressStatus>;
  comment: Record<string, string>;
}

interface Props {
  studentName: string;
  periodLabel: string;
  sessionCount: number;
  goals: GoalProgress[];
  settings: ProgressReportSettings;
  edits: ProgressReportEdits;
  /** On screen: status and comments can be changed before printing. */
  onEdit?: (goalId: string, change: { status?: ProgressStatus; comment?: string }) => void;
}

const STATUS_STYLES: Record<ProgressStatus, string> = {
  mastered: 'bg-green-100 text-green-900 border-green-300',
  progressing: 'bg-amber-50 text-amber-900 border-amber-300',
  limited: 'bg-orange-50 text-orange-900 border-orange-300',
  'not-progressing': 'bg-red-50 text-red-900 border-red-300',
  'too-few': 'bg-slate-100 text-slate-700 border-slate-300',
  'not-addressed': 'bg-slate-100 text-slate-700 border-slate-300',
};

function StatusPill({ status }: { status: ProgressStatus }) {
  return (
    <span className={cn('inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLES[status])}>
      {PROGRESS_STATUS_LABELS[status]}
    </span>
  );
}

function Logo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="hsl(35 75% 45%)" className="h-8 w-8 shrink-0" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.09L6.71 11.8l1.41-1.41L11 13.27l4.88-4.88 1.41 1.41L11 16.09z" />
    </svg>
  );
}

export default function ProgressReportDocument({ studentName, periodLabel, sessionCount, goals, settings, edits, onEdit }: Props) {
  const statusOf = (g: GoalProgress) => edits.status[g.goal.id] ?? g.status;
  const commentOf = (g: GoalProgress) => edits.comment[g.goal.id] ?? g.comment;
  const today = formatDate(new Date());

  return (
    <article className="report-paper mx-auto w-full max-w-[8.5in] rounded-md p-6 text-[13px] leading-relaxed shadow-lg sm:p-10 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-4 border-b-2 border-[hsl(var(--primary))] pb-3">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-xl font-bold leading-tight">IEP Goal Progress Report</h1>
            <p className="text-xs text-muted-foreground">{APP_NAME}</p>
          </div>
        </div>
        <p className="text-right text-xs font-semibold uppercase tracking-wide text-[hsl(var(--report-accent))]">Confidential student record</p>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        {[
          ['Student', studentName],
          ['Reporting period', periodLabel],
          ['Prepared by', settings.preparedBy.trim() || '—'],
          ['Date', today],
        ].map(([term, value]) => (
          <div key={term}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{term}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-6 report-avoid-break" aria-labelledby="report-summary">
        <h2 id="report-summary" className="mb-2 text-sm font-bold uppercase tracking-wide text-[hsl(var(--report-accent))]">Summary</h2>
        <p className="mb-2 text-muted-foreground">
          {plural(goals.length, 'goal')} · {plural(sessionCount, 'session')} with data in this period
        </p>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-1.5 pr-2 font-semibold">Goal</th>
              <th scope="col" className="py-1.5 pr-2 font-semibold">Progress</th>
              <th scope="col" className="py-1.5 pr-2 font-semibold">Latest</th>
              <th scope="col" className="py-1.5 pr-2 font-semibold">Average</th>
              <th scope="col" className="py-1.5 font-semibold">Target met</th>
            </tr>
          </thead>
          <tbody>
            {goals.map(g => (
              <tr key={g.goal.id} className="border-b border-border/60 align-top">
                <th scope="row" className="py-1.5 pr-2 font-medium">{g.number}. {g.goal.name}</th>
                <td className="py-1.5 pr-2"><StatusPill status={statusOf(g)} /></td>
                <td className="py-1.5 pr-2">{g.latest ?? '—'}</td>
                <td className="py-1.5 pr-2">{g.average ?? '—'}</td>
                <td className="py-1.5">{g.target !== undefined && g.sessionCount ? `${g.metCount} of ${g.sessionCount}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {goals.map(g => (
        <section key={g.goal.id} className="mt-6 border-t border-border pt-4 report-avoid-break" aria-labelledby={`goal-${g.goal.id}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id={`goal-${g.goal.id}`} className="text-base font-bold">Goal {g.number}: {g.goal.name}</h2>
              <p className="text-xs text-muted-foreground">
                {g.typeLabel}{g.targetLabel ? ` · Target ${g.targetLabel}` : ''}
              </p>
            </div>
            {onEdit ? (
              <label className="flex items-center gap-2 text-xs print:hidden">
                <span className="font-semibold">Progress</span>
                <select
                  value={statusOf(g)}
                  onChange={e => onEdit(g.goal.id, { status: e.target.value as ProgressStatus })}
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                >
                  {(Object.keys(PROGRESS_STATUS_LABELS) as ProgressStatus[]).map(s => (
                    <option key={s} value={s}>{PROGRESS_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </label>
            ) : (
              <StatusPill status={statusOf(g)} />
            )}
          </div>

          {g.goal.smartGoal && <p className="mt-2 italic">{g.goal.smartGoal}</p>}

          {g.sessionCount > 0 && (
            <dl className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-muted/60 p-3 sm:grid-cols-5">
              {[
                ['Sessions', String(g.sessionCount)],
                ['Average', g.average ?? '—'],
                ['Range', g.range ?? '—'],
                ['Latest', g.latest ? `${g.latest}${g.latestDate ? ` (${formatDate(g.latestDate)})` : ''}` : '—'],
                ['Target met', g.target !== undefined ? `${g.metCount} of ${g.sessionCount}` : '—'],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{term}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {settings.showCharts && g.points.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.measureLabel} by session</p>
              <ProgressReportChart progress={g} />
            </div>
          )}

          <div className="mt-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Comments</h3>
            {onEdit ? (
              <Textarea
                value={commentOf(g)}
                onChange={e => onEdit(g.goal.id, { comment: e.target.value })}
                aria-label={`Comments for goal ${g.number}`}
                className="mt-1 min-h-[96px] text-[13px] print:hidden"
              />
            ) : (
              <p className="mt-1 whitespace-pre-wrap">{commentOf(g) || '—'}</p>
            )}
            {settings.showNextSteps && g.nextStep && (
              <p className="mt-2"><span className="font-semibold text-[hsl(var(--report-accent))]">Suggested next step: </span>{g.nextStep}</p>
            )}
          </div>
        </section>
      ))}

      <footer className="mt-8 border-t border-border pt-2 text-[11px] text-muted-foreground">
        Contains confidential student information protected by FERPA. Share only with the student&apos;s IEP team and
        family. Figures are calculated from session data recorded in {APP_NAME}.
      </footer>
    </article>
  );
}
