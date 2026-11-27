
'use client';

import React, { useState, useMemo, useEffect, useDeferredValue, Suspense, useRef } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import type { SessionData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MISSED_REASON_LABELS, MISSED_REASON_SHORT } from '@/lib/attendance';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFillScreenHeight } from '@/hooks/use-fill-screen-height';
import { Edit, Trash2, Search, Info, Eye, FileText, Merge } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { mergeProblem } from '@/lib/session-merge';
import { compareSessionsOldestFirst, formatDate, sessionInDateRange, sessionMinutes } from '@/lib/helpers';

import { Skeleton } from '@/components/ui/skeleton';
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range';
import type { DateRange } from "react-day-picker";
import { LazyBoundary, retryableLazy } from '@/components/ui/lazy-boundary';

// Dynamically imported modals. Declared once here: created inside the component, each render made a new
// component type, so an open modal was thrown away and loaded again whenever the page re-rendered.
const EditSessionModal = retryableLazy(() => import('@/components/modals/edit-session-modal'));
const ConfirmationModal = retryableLazy(() => import('@/components/modals/confirmation-modal'));
const ViewSessionDetailsModal = retryableLazy(() => import('@/components/modals/view-session-details-modal'));
const MergeSessionsDialog = retryableLazy(() => import('@/components/sessions/MergeSessionsDialog'));

/** A session's minutes for the Minutes column: "30 min", or a dash when it was missed or its times aren't both set. */
function sessionLength(session: SessionData): string {
  if (session.missed) return '—';
  const minutes = sessionMinutes(session);
  return minutes === null ? '—' : `${minutes} min`;
}

/** How many sessions the table shows at first, and how many more each "Show more" adds. */
const SESSIONS_PAGE_SIZE = 100;

export default function ManageSessionsPage() {
  const { 
    sessions, 
    students,
    loading: studentsLoading,
    sessionsLoading, 
    openEditSessionModal,
    closeEditSessionModal,
    openDeleteSessionModal,
    editingSession, // For EditSessionModal
    deletingSession, // For ConfirmationModal
    mergeSessionRecords,
  } = useStudentData();
  // Ticked session ids (records of one session saved in parts, to merge). What counts as selected is worked out
  // from the sessions on screen below, not from this set alone.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const toggleSelected = (id: string, on: boolean) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (on) next.add(id); else next.delete(id);
    return next;
  });

  const [selectedStudentId, setSelectedStudentId] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState(''); // Search by activity or notes
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [viewingSessionDetails, setViewingSessionDetails] = useState<SessionData | null>(null);
  // The list filters on the search a moment behind the typing, so a long list never holds up the keyboard.
  const search = useDeferredValue(searchTerm);
  // Sessions are shown a page at a time: drawing every row of a long caseload at once froze the page for seconds.
  const [shownCount, setShownCount] = useState(SESSIONS_PAGE_SIZE);
  // Changing the filters clears the ticks, so a merge never includes sessions that aren't shown, and goes back to
  // the first page.
  useEffect(() => { setSelectedIds(new Set()); setShownCount(SESSIONS_PAGE_SIZE); }, [selectedStudentId, search, dateRange]);


  const filteredSessions = useMemo(() => {
    const query = search.toLowerCase();
    return sessions
      .filter(session => {
        const studentMatch = selectedStudentId === 'ALL' || session.studentId === selectedStudentId;
        const searchMatch = query === '' ||
                            (session.activity || '').toLowerCase().includes(query) ||
                            (session.notes || '').toLowerCase().includes(query);
        
        // The range includes the whole of its last day.
        const dateMatch = sessionInDateRange(session.date, dateRange?.from, dateRange?.to);
        
        return studentMatch && searchMatch && dateMatch;
      })
      .sort((a, b) => compareSessionsOldestFirst(b, a)); // Newest first
  }, [sessions, selectedStudentId, search, dateRange]);

  // The selection is the ticked sessions that are on screen: one rule covers a session that was deleted, merged
  // away, or edited out of the filters, so the count, the merge check and the merge itself never include a record
  // the user can't see.
  const shownSessions = useMemo(() => filteredSessions.slice(0, shownCount), [filteredSessions, shownCount]);
  const selectedSessions = useMemo(() => shownSessions.filter(s => selectedIds.has(s.sessionId)), [shownSessions, selectedIds]);
  const mergeBlocked = mergeProblem(selectedSessions);
  // If the selection stops being mergeable while the dialog is open (a part deleted, say from another tab), close it
  // for good rather than hiding it, so it can't reappear later without a click on Merge Selected.
  useEffect(() => {
    if (isMergeOpen && mergeBlocked) setIsMergeOpen(false);
  }, [isMergeOpen, mergeBlocked]);

  // The list fills the screen down to the menu bar (or the bottom edge), instead of a fixed 500px that left the card
  // ending halfway down with the menu bar and the footer under it.
  const pageRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listHeight = useFillScreenHeight(listRef, pageRef, 320, !(studentsLoading && students.length === 0));

  if (studentsLoading && students.length === 0) { // Only show global skeleton if students are also loading
    return <SessionsPageSkeleton />;
  }
  
  return (
    <div ref={pageRef} className="space-y-6">
      {editingSession && (
        <LazyBoundary label="Edit Session dialog" onDismiss={closeEditSessionModal}>
          <Suspense fallback={null}><EditSessionModal sessionToEdit={editingSession} /></Suspense>
        </LazyBoundary>
      )}
      {deletingSession && (
        <LazyBoundary label="Confirmation dialog" onDismiss={() => openDeleteSessionModal(null)}>
          <Suspense fallback={null}>
            <ConfirmationModal
              isOpen={!!deletingSession}
              onClose={() => openDeleteSessionModal(null)}
              title={`Delete Session for ${deletingSession.studentName}`}
              description={`Are you sure you want to delete this session from ${formatDate(deletingSession.date)} at ${deletingSession.time}? This action cannot be undone.`}
              itemToDelete={deletingSession}
              deleteActionType="session"
            />
          </Suspense>
        </LazyBoundary>
      )}
      {viewingSessionDetails && (
        <LazyBoundary label="Session Details dialog" onDismiss={() => setViewingSessionDetails(null)}>
          <Suspense fallback={null}>
            <ViewSessionDetailsModal
              session={viewingSessionDetails}
              isOpen={!!viewingSessionDetails}
              onClose={() => setViewingSessionDetails(null)}
            />
          </Suspense>
        </LazyBoundary>
      )}
      {isMergeOpen && (
        <LazyBoundary label="Merge Sessions dialog" onDismiss={() => setIsMergeOpen(false)}>
          <Suspense fallback={null}>
            <MergeSessionsDialog
              sessions={selectedSessions}
              open={isMergeOpen}
              onCancel={() => setIsMergeOpen(false)}
              onConfirm={async () => {
                if (await mergeSessionRecords(selectedSessions.map(s => s.sessionId))) setSelectedIds(new Set());
                setIsMergeOpen(false);
              }}
            />
          </Suspense>
        </LazyBoundary>
      )}

      <Card className="shadow-lg">
        <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
                <CardTitle role="heading" aria-level={1} className="text-2xl font-bold flex items-center gap-2">
                    <FileText className="h-7 w-7 text-primary"/>Manage Sessions
                </CardTitle>
                <CardDescription>View, edit, or delete past session records. Filter by student, date, or keywords. To merge a session saved in parts, tick its records and choose Merge Selected.</CardDescription>
            </div>
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <Button size="sm" variant="outline" disabled={!!mergeBlocked} onClick={() => setIsMergeOpen(true)}>
                <Merge className="mr-2 h-4 w-4" />Merge Selected{selectedSessions.length ? ` (${selectedSessions.length})` : ''}
              </Button>
              {selectedSessions.length > 0 && mergeBlocked && <p className="text-xs text-muted-foreground" role="status">{mergeBlocked}</p>}
            </div>
            {/* Optional: Button to navigate to Data Entry Page */}
            {/* <Link href="/data-entry"><Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> New Session</Button></Link> */}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-2 mb-4">
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger className="w-full md:w-[200px]" aria-label="Student">
                <SelectValue placeholder="Filter by student" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Students</SelectItem>
                {students.map(student => (
                  <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                type="search"
                placeholder="Search by activity or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full"
                />
            </div>
            <DatePickerWithRange date={dateRange} setDate={setDateRange} className="w-full md:w-auto" />
          </div>

          <div ref={listRef} className="h-[500px] overflow-auto border rounded-md" style={listHeight ? { height: listHeight } : undefined}>
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-10 bg-muted [&_th]:text-foreground">
                <TableRow>
                  <TableHead className="w-10"><span className="sr-only">Select to merge</span></TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead className="text-right">Minutes</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionsLoading ? (
                    [...Array(10)].map((_, i) => (
                        <TableRow key={`skel-${i}`}>
                            <TableCell />
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                            <TableCell><Skeleton className="ml-auto h-5 w-12" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                            <TableCell className="text-right space-x-1">
                                <Skeleton className="h-8 w-8 inline-block rounded-md" />
                                <Skeleton className="h-8 w-8 inline-block rounded-md" />
                                <Skeleton className="h-8 w-8 inline-block rounded-md" />
                            </TableCell>
                        </TableRow>
                    ))
                ) : filteredSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      <Info className="mx-auto h-10 w-10 mb-2" />
                      No sessions found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  shownSessions.map((session) => (
                    <TableRow key={session.sessionId} data-state={selectedIds.has(session.sessionId) ? 'selected' : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(session.sessionId)}
                          onCheckedChange={v => toggleSelected(session.sessionId, v === true)}
                          aria-label={`Select ${session.studentName}'s session on ${formatDate(session.date)} at ${session.time} to merge`}
                          disabled={!!session.missed}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{session.studentName}</TableCell>
                      <TableCell>{formatDate(session.date)}</TableCell>
                      <TableCell>{session.time}</TableCell>
                      <TableCell>{session.endTime || 'N/A'}</TableCell>
                      {/* The session's length from its start and end times; none for a missed session or one without both. */}
                      <TableCell className="text-right tabular-nums">{sessionLength(session)}</TableCell>
                      <TableCell className="truncate max-w-xs" title={session.missed ? MISSED_REASON_LABELS[session.missed.reason] : session.activity}>
                        {session.missed ? (
                          <span className="inline-block rounded-full border border-orange-400/50 bg-orange-400/10 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-300">
                            Missed: {MISSED_REASON_SHORT[session.missed.reason]}
                          </span>
                        ) : session.activity}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                         <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingSessionDetails(session)} title="View Details">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSessionModal(session)} title="Edit Session">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDeleteSessionModal(session)} title="Delete Session">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </table>
          </div>
          {!sessionsLoading && filteredSessions.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <p role="status">
                Showing {shownSessions.length.toLocaleString()} of {filteredSessions.length.toLocaleString()} {filteredSessions.length === 1 ? 'session' : 'sessions'}, newest first
              </p>
              {shownSessions.length < filteredSessions.length && (
                <Button type="button" variant="outline" size="sm" onClick={() => setShownCount(n => n + SESSIONS_PAGE_SIZE)}>
                  Show {Math.min(SESSIONS_PAGE_SIZE, filteredSessions.length - shownSessions.length)} more
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


function SessionsPageSkeleton() {
    return (
         <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                            <Skeleton className="h-8 w-48 mb-1" />
                            <Skeleton className="h-4 w-72" />
                        </div>
                        <Skeleton className="h-9 w-32" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-2 mb-4">
                        <Skeleton className="h-10 w-full md:w-[200px]" />
                        <Skeleton className="h-10 w-full flex-grow" />
                        <Skeleton className="h-10 w-full md:w-[240px]" />
                    </div>
                    <Skeleton className="h-[500px] w-full rounded-md border" />
                </CardContent>
            </Card>
        </div>
    )
}
