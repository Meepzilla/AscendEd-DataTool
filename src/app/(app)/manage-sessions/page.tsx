
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import type { SessionData, Student } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Edit, Trash2, Search, ListFilter, Info, Eye, FileText } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/helpers';
import EditSessionModal from '@/components/modals/edit-session-modal'; // To be created
import ConfirmationModal from '@/components/modals/confirmation-modal';
import { Skeleton } from '@/components/ui/skeleton';
import ViewSessionDetailsModal from '@/components/modals/view-session-details-modal'; // To be created
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range'; // Assuming this component exists
import type { DateRange } from "react-day-picker";

export default function ManageSessionsPage() {
  const { 
    sessions, 
    students,
    loading: dataLoading, 
    openEditSessionModal,
    openDeleteSessionModal,
    editingSession, // For EditSessionModal
    deletingSession, // For ConfirmationModal
  } = useStudentData();

  const [selectedStudentId, setSelectedStudentId] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState(''); // Search by activity or notes
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [viewingSessionDetails, setViewingSessionDetails] = useState<SessionData | null>(null);


  const filteredSessions = useMemo(() => {
    return sessions
      .filter(session => {
        const studentMatch = selectedStudentId === 'ALL' || session.studentId === selectedStudentId;
        const searchMatch = searchTerm === '' || 
                            session.activity.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            session.notes.toLowerCase().includes(searchTerm.toLowerCase());
        
        let dateMatch = true;
        if (dateRange?.from) {
            dateMatch = new Date(session.date) >= dateRange.from;
        }
        if (dateRange?.to && dateMatch) {
            // Adjust 'to' date to include the whole day
            const toDate = new Date(dateRange.to);
            toDate.setHours(23, 59, 59, 999);
            dateMatch = new Date(session.date) <= toDate;
        }
        
        return studentMatch && searchMatch && dateMatch;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.time.localeCompare(a.time)); // Sort by date then time
  }, [sessions, selectedStudentId, searchTerm, dateRange]);

  if (dataLoading && students.length === 0) { // Only show global skeleton if students are also loading
    return <SessionsPageSkeleton />;
  }
  
  return (
    <div className="space-y-6">
      {editingSession && <EditSessionModal sessionToEdit={editingSession} />}
      {deletingSession && (
        <ConfirmationModal
          isOpen={!!deletingSession}
          onClose={() => openDeleteSessionModal(null)}
          title={`Delete Session for ${deletingSession.studentName}`}
          description={`Are you sure you want to delete this session from ${formatDate(deletingSession.date)} at ${deletingSession.time}? This action cannot be undone.`}
          itemToDelete={deletingSession}
          deleteActionType="session"
        />
      )}
      {viewingSessionDetails && (
        <ViewSessionDetailsModal
            session={viewingSessionDetails}
            isOpen={!!viewingSessionDetails}
            onClose={() => setViewingSessionDetails(null)}
        />
      )}


      <Card className="shadow-lg">
        <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <FileText className="h-7 w-7 text-primary"/>Manage Sessions
                </CardTitle>
                <CardDescription>View, edit, or delete past session records. Filter by student, date, or keywords.</CardDescription>
            </div>
            {/* Optional: Button to navigate to Data Entry Page */}
            {/* <Link href="/data-entry"><Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> New Session</Button></Link> */}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-2 mb-4">
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger className="w-full md:w-[200px]">
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

          <ScrollArea className="h-[500px] border rounded-md"> {/* Adjust height as needed */}
            <Table>
              <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataLoading && filteredSessions.length === 0 ? (
                    [...Array(5)].map((_, i) => (
                        <TableRow key={`skel-${i}`}>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-16" /></TableCell>
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
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      <Info className="mx-auto h-10 w-10 mb-2" />
                      No sessions found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSessions.map((session) => (
                    <TableRow key={session.sessionId}>
                      <TableCell className="font-medium">{session.studentName}</TableCell>
                      <TableCell>{formatDate(session.date)}</TableCell>
                      <TableCell>{session.time}</TableCell>
                      <TableCell className="truncate max-w-xs" title={session.activity}>{session.activity}</TableCell>
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
            </Table>
          </ScrollArea>
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
