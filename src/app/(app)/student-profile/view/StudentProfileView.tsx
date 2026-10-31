
'use client';

import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, Goal } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Edit, Trash2, PlusCircle, Info, Target, Edit3, CheckSquare, TrendingUp, Archive, ArchiveRestore, Upload, Download, ArrowLeft } from 'lucide-react';
import { formatDate, formatGoalTarget, goalStatement, goalTypeLabel } from '@/lib/helpers';
import { captureTypeOf } from '@/lib/goal-constants';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { downloadSessionsCsv } from '@/lib/session-csv';
import CsvExportWarning from '@/components/CsvExportWarning';
import { useToast } from '@/hooks/use-toast';

import AssignGoalToStudentModal from '@/components/modals/assign-goal-to-student-modal';
import EditAssignedGoalModal from '@/components/modals/edit-assigned-goal-modal';
import StudentOverviewCard from '@/components/student-profile/StudentOverviewCard';
import ConfirmationModal from '@/components/modals/confirmation-modal';
import { cn } from '@/lib/utils';

const ImportDataModal = lazy(() => import('@/components/modals/import-data-modal'));


export default function StudentProfileView() {
  const searchParams = useSearchParams();
  const studentIdFromParams = searchParams.get('id') ?? undefined;
  const router = useRouter();
  const { toast } = useToast();
  
  const {
    students,
    sessions,
    loading, 
    error,
    selectedStudent,
    setSelectedStudent,
    openEditStudentModal, 
    deletingStudent, 
    openDeleteConfirmationModal,
    closeDeleteConfirmationModal, 
    removeGoalFromStudent,
    editingAssignedGoal, 
    openEditAssignedGoalModal, 
    closeEditAssignedGoalModal, 
    updateStudentGoal,
    updateStudent,
    importSessions,
    deletingAssignedGoal,
    openDeleteAssignedGoalConfirmationModal,
    closeDeleteAssignedGoalConfirmationModal,
    deleteStudent,
  } = useStudentData();

  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [isCsvWarningOpen, setIsCsvWarningOpen] = useState(false);
  const [isAssignGoalModalOpen, setIsAssignGoalModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);


  useEffect(() => {
    if (studentIdFromParams) {
      const foundStudent = students.find(s => s.id === studentIdFromParams);
      if (foundStudent) {
        setCurrentStudent(foundStudent);
        if (!selectedStudent || selectedStudent.id !== foundStudent.id) {
          setSelectedStudent(foundStudent);
        }
      } else if (!loading) { // If not loading and student not found
        setCurrentStudent(null);
      }
    } else if (!loading) { // If no studentId in URL and not loading
      setCurrentStudent(null);
    }
  }, [studentIdFromParams, students, loading, selectedStudent, setSelectedStudent]);

  const studentSessions = React.useMemo(() => {
    if (!currentStudent) return [];
    return sessions.filter(s => s.studentId === currentStudent.id);
  }, [currentStudent, sessions]);


  if (loading && !currentStudent) { 
    return <StudentProfileSkeleton />;
  }

  if (error) {
    return <div className="text-destructive p-4">Error loading student data: {error.message}</div>;
  }

  if (!currentStudent && !loading) {
    const studentIdDisplay = studentIdFromParams || 'unknown';
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Info className="text-destructive"/>Student Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p>The student with ID &ldquo;{studentIdDisplay}&rdquo; could not be found. They may have been deleted or the ID is incorrect.</p>
          <Button onClick={() => router.push('/student-profile')} className="mt-4">Go to Student Selection</Button>
        </CardContent>
      </Card>
    );
  }
  
  if (!currentStudent) {
    return <StudentProfileSkeleton />; 
  }

  const handleExportData = () => {
    if (!currentStudent || studentSessions.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There is no session data for this student.",
        variant: "default",
      });
      return;
    }
    // Confirmed in CsvExportWarning first (the file holds student data in plain text).
    setIsCsvWarningOpen(true);
  };

  const handleOpenEditAssignedGoalModal = (goal: Goal) => {
    if (currentStudent) {
      openEditAssignedGoalModal(currentStudent.id, goal);
    }
  };

  const handleToggleArchiveGoal = async (goal: Goal) => {
    if (currentStudent) {
      await updateStudentGoal(currentStudent.id, goal.id, { isArchived: !goal.isArchived });
    }
  };

  const handleToggleArchiveStudent = () => {
    if (currentStudent) {
      openDeleteConfirmationModal(currentStudent, 'student');
    }
  };
  
  const handleDeleteStudent = () => {
      if (currentStudent) {
          setIsDeleteConfirmationOpen(true);
      }
  };


  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        {isImportModalOpen && <ImportDataModal onClose={() => setIsImportModalOpen(false)} onImport={importSessions} />}
      </Suspense>

      {editingAssignedGoal && currentStudent && (
        <EditAssignedGoalModal
          isOpen={!!editingAssignedGoal}
          onClose={closeEditAssignedGoalModal}
          studentId={editingAssignedGoal.studentId} 
          goalToEdit={editingAssignedGoal.goal}
        />
      )}
      
      {deletingAssignedGoal && (
        <ConfirmationModal
          isOpen={!!deletingAssignedGoal}
          onClose={closeDeleteAssignedGoalConfirmationModal}
          onConfirm={() => {
            if (deletingAssignedGoal) {
              removeGoalFromStudent(deletingAssignedGoal.studentId, deletingAssignedGoal.goal.id);
            }
          }}
          title={`Remove Goal: "${deletingAssignedGoal.goal.name}"?`}
          description={`Are you sure you want to remove this goal from ${currentStudent.name}? This action cannot be undone.`}
          confirmText="Yes, Remove Goal"
        />
      )}
        
      {/* Modal for Archiving */}
      {deletingStudent && deletingStudent.type === 'student' && (
         <ConfirmationModal
            isOpen={!!deletingStudent}
            onClose={closeDeleteConfirmationModal}
            title={
                (deletingStudent.item as Student).isArchived ? `Unarchive Student: ${(deletingStudent.item as Student).name}` : `Archive Student: ${(deletingStudent.item as Student).name}`
            }
            description={
                (deletingStudent.item as Student).isArchived ? "Unarchiving this student will make them visible in all active lists again. Are you sure?" : "Archiving a student will hide them from active lists. Their data will be preserved. Are you sure?"
            }
            onConfirm={() => {
                updateStudent((deletingStudent.item as Student).id, { isArchived: !(deletingStudent.item as Student).isArchived })
            }}
            confirmText={
                (deletingStudent.item as Student).isArchived ? 'Yes, Unarchive' : 'Yes, Archive'
            }
        />
      )}

      {/* Modal for Deleting */}
      {isDeleteConfirmationOpen && currentStudent && (
          <ConfirmationModal
              isOpen={isDeleteConfirmationOpen}
              onClose={() => setIsDeleteConfirmationOpen(false)}
              title={`Delete Student: ${currentStudent.name}?`}
              description="Are you sure you want to permanently delete this student and all their associated session data? This action cannot be undone."
              onConfirm={() => {
                deleteStudent(currentStudent.id);
                setIsDeleteConfirmationOpen(false); // Close modal on confirm
                router.push('/student-profile'); // Redirect after delete
              }}
              confirmText="Yes, Delete Permanently"
          />
      )}


      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
             <Link href="/student-profile" passHref>
                <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                  <ArrowLeft className="h-6 w-6" />
                  <span className="sr-only">Back to All Students</span>
                </Button>
              </Link>
            <Avatar className="h-14 w-14 sm:h-16 sm:w-16">
              <AvatarFallback className="bg-primary/15 text-primary text-xl font-semibold">{currentStudent.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle role="heading" aria-level={1} className="text-2xl sm:text-3xl font-bold">{currentStudent.name}</CardTitle>
                {currentStudent.isArchived && <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-900/20">Archived</Badge>}
              </div>
              <CardDescription className="text-xs sm:text-sm">
                Student ID: {currentStudent.id} | Joined: {formatDate(currentStudent.createdAt)}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-2 mt-3 sm:mt-0 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={handleExportData} className="w-full sm:w-auto" disabled={studentSessions.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export Data
            </Button>
                {currentStudent && (
                  <CsvExportWarning
                    studentName={currentStudent.name}
                    open={isCsvWarningOpen}
                    onCancel={() => setIsCsvWarningOpen(false)}
                    onConfirm={() => { setIsCsvWarningOpen(false); downloadSessionsCsv(studentSessions, currentStudent.name); }}
                  />
                )}
            <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(true)} className="w-full sm:w-auto">
              <Upload className="mr-2 h-4 w-4" /> Import Data
            </Button>
            <Button variant="outline" size="sm" onClick={() => openEditStudentModal(currentStudent)} className="w-full sm:w-auto">
              <Edit3 className="mr-2 h-4 w-4" /> Edit Student Info
            </Button>
            <Button variant="outline" size="sm" onClick={handleToggleArchiveStudent} className={cn("w-full sm:w-auto", currentStudent.isArchived ? "text-green-600 hover:text-green-700 border-green-500 hover:bg-green-50" : "text-orange-600 hover:text-orange-700 border-orange-500 hover:bg-orange-50")}>
              {currentStudent.isArchived ? <ArchiveRestore className="mr-2 h-4 w-4"/> : <Archive className="mr-2 h-4 w-4"/>}
              {currentStudent.isArchived ? 'Unarchive' : 'Archive'}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteStudent} className="w-full sm:w-auto">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </CardHeader>
      </Card>

      <StudentOverviewCard student={currentStudent} sessions={studentSessions} />

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <CardTitle className="flex items-center gap-2"><Target className="text-primary" /> Assigned Goals ({currentStudent.goals.filter(g => !g.isArchived).length} Active / {currentStudent.goals.length} Total)</CardTitle>
          <Button size="sm" onClick={() => setIsAssignGoalModalOpen(true)} className="w-full sm:w-auto mt-2 sm:mt-0">
            <PlusCircle className="mr-2 h-4 w-4" /> Assign / Create Goal
          </Button>
        </CardHeader>
        <CardContent>
          {currentStudent.goals.length === 0 ? (
            <p className="text-muted-foreground">No goals assigned to this student yet. Click &ldquo;Assign / Create Goal&rdquo; to add one.</p>
          ) : (
            <ul className="space-y-4">
              {currentStudent.goals.map((goal) => (
                <li key={goal.id} className={`p-4 border rounded-lg shadow-sm bg-card hover:shadow-md transition-shadow ${goal.isArchived ? 'opacity-60 bg-muted/50' : ''}`}>
                  <div className="flex flex-col sm:flex-row justify-between items-start">
                    <div className="flex-grow">
                      <h3 className="text-lg font-semibold text-primary">{goal.name}</h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge variant="secondary">{goalTypeLabel(goal.type)}</Badge>
                        {goal.sessionTargetValue !== undefined && (
                          <Badge variant="outline">
                            <TrendingUp className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                            Target: {formatGoalTarget(captureTypeOf(goal), goal.sessionTargetValue, goal.targetDirection)}
                          </Badge>
                        )}
                        {goal.isArchived && <Badge variant="outline" className="border-orange-500 text-orange-600">Archived</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{goalStatement(goal, currentStudent.name)}</p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0 mt-2 sm:mt-0 sm:ml-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditAssignedGoalModal(goal)} title="Edit Assigned Goal">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDeleteAssignedGoalConfirmationModal(currentStudent.id, goal)} title="Remove Goal Assignment">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleArchiveGoal(goal)} title={goal.isArchived ? "Unarchive Goal" : "Archive Goal"}>
                        {goal.isArchived ? <ArchiveRestore className="h-4 w-4 text-green-600" /> : <Archive className="h-4 w-4 text-orange-600" />}
                      </Button>
                    </div>
                  </div>
                  {!goal.isArchived && (
                    <div className="mt-3 pt-3 border-t">
                       <Link href={`/data-entry?studentId=${currentStudent.id}&goalId=${goal.id}`}
                             className="inline-flex items-center text-sm text-primary hover:underline">
                          <CheckSquare className="mr-2 h-4 w-4" /> Enter/View Progress Data
                       </Link>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {isAssignGoalModalOpen && currentStudent && (
        <AssignGoalToStudentModal
          student={currentStudent}
          isOpen={isAssignGoalModalOpen}
          onClose={() => setIsAssignGoalModalOpen(false)}
        />
      )}
    </div>
  );
}


function StudentProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
            <Skeleton className="h-9 w-full sm:w-32" />
            <Skeleton className="h-9 w-full sm:w-28" />
            <Skeleton className="h-9 w-full sm:w-32" />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-9 w-full sm:w-36" />
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="text-center py-6 text-muted-foreground">
                <Info className="mx-auto h-10 w-10 mb-2 text-primary" />
                Loading student goals...
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

