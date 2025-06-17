
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, Goal, GoalTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, Trash2, PlusCircle, Info, Target, Edit3, CheckSquare, TrendingUp } from 'lucide-react';
import { formatDate, generateUUID } from '@/lib/helpers'; 
import Link from 'next/link';
import EditStudentModal from '@/components/modals/edit-student-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import AssignGoalToStudentModal from '@/components/modals/assign-goal-to-student-modal';
import EditAssignedGoalModal from '@/components/modals/edit-assigned-goal-modal';


export default function StudentProfilePage() {
  const routeParams = useParams(); // Renamed from params to avoid confusion
  const router = useRouter();
  // const studentIdFromRoute = routeParams?.studentId as string; // Initial derivation if needed, but prefer in-effect

  const {
    students,
    loading, // This is studentData loading
    error,
    isFirebaseDBAvailable,
    selectedStudent,
    setSelectedStudent,
    openEditStudentModal,
    editingStudent, // This comes from useStudentData, used to control EditStudentModal
    openDeleteStudentModal,
    removeGoalFromStudent,
    editingAssignedGoal, 
    openEditAssignedGoalModal, 
    closeEditAssignedGoalModal, 
  } = useStudentData();

  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [isAssignGoalModalOpen, setIsAssignGoalModalOpen] = useState(false);

  useEffect(() => {
    let studentIdToProcess: string | undefined = undefined;

    if (routeParams && typeof routeParams.studentId === 'string') {
      studentIdToProcess = routeParams.studentId;
    }

    if (studentIdToProcess) {
      const foundStudent = students.find(s => s.id === studentIdToProcess);
      if (foundStudent) {
        setCurrentStudent(foundStudent);
        // Ensure the global selected student in context is updated if this page is directly navigated to
        if (!selectedStudent || selectedStudent.id !== foundStudent.id) {
          setSelectedStudent(foundStudent);
        }
      } else if (!loading && students.length > 0) {
        // studentId is valid from URL, but student not found in loaded data
        setCurrentStudent(null); // Explicitly set to null if not found
        // Optionally, redirect or show a more specific "not found" message here
        // For now, existing "Student Not Found" card will handle display
      }
    } else if (routeParams === null && !loading) {
      // useParams resolved to null, meaning route might not be a dynamic match or error in routing
      setCurrentStudent(null);
      // router.push('/student-profile'); // Redirect to general student page
    }
    // If routeParams is undefined (still loading), do nothing, let loading skeletons show
  }, [routeParams, students, loading, selectedStudent, setSelectedStudent, router]);


  if (loading && !currentStudent) { 
    return <StudentProfileSkeleton />;
  }

  if (error) {
    return <div className="text-destructive p-4">Error loading student data: {error.message}</div>;
  }

  // This condition handles cases where studentId might be invalid, or student not found after data loads
  if (!currentStudent && !loading) {
    const studentIdDisplay = typeof routeParams?.studentId === 'string' ? routeParams.studentId : 'unknown';
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Info className="text-destructive"/>Student Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p>The student with ID "{studentIdDisplay}" could not be found. They may have been deleted or the ID is incorrect.</p>
          {!isFirebaseDBAvailable && <p className="text-orange-500 font-semibold mt-2">(Operating in Local Mode)</p>}
          <Button onClick={() => router.push('/student-profile')} className="mt-4">Go to Student Selection</Button>
        </CardContent>
      </Card>
    );
  }
  
  // If currentStudent is still null but loading is false, it means it was not found or id was invalid
  // This check might be redundant if the above one catches all !currentStudent cases post-loading.
  // However, it's a fallback.
  if (!currentStudent) {
    return <StudentProfileSkeleton />; // Or a "Student not found" message if preferred
  }


  const handleRemoveGoal = async (goalId: string) => {
    if (currentStudent) { // Ensure currentStudent is not null
        await removeGoalFromStudent(currentStudent.id, goalId);
    }
  };

  const handleOpenEditAssignedGoalModal = (goal: Goal) => {
    if (currentStudent) {
      openEditAssignedGoalModal(currentStudent.id, goal);
    }
  };


  return (
    <div className="space-y-6">
      {/* The `editingStudent` for EditStudentModal is managed by useStudentData context */}
      {editingStudent && <EditStudentModal studentToEdit={editingStudent} />}
      {/* `editingAssignedGoal` is also from context */}
      {editingAssignedGoal && currentStudent && (
        <EditAssignedGoalModal
          isOpen={!!editingAssignedGoal}
          onClose={closeEditAssignedGoalModal}
          studentId={editingAssignedGoal.studentId} // This should be currentStudent.id
          goalToEdit={editingAssignedGoal.goal}
        />
      )}


      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Avatar className="h-14 w-14 sm:h-16 sm:w-16">
              <AvatarImage src={`https://avatar.vercel.sh/${currentStudent.id}.png?text=${currentStudent.name.substring(0,2).toUpperCase()}`} alt={currentStudent.name} data-ai-hint="abstract avatar"/>
              <AvatarFallback>{currentStudent.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl sm:text-3xl font-bold">{currentStudent.name}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Student ID: {currentStudent.id} | Joined: {formatDate(currentStudent.createdAt)}
                {!isFirebaseDBAvailable && !loading && <span className="text-orange-500 font-semibold block">(Local Mode)</span>}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-2 mt-3 sm:mt-0 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={() => openEditStudentModal(currentStudent)} className="w-full sm:w-auto">
              <Edit3 className="mr-2 h-4 w-4" /> Edit Student Info
            </Button>
            <Button variant="destructive"  size="sm" onClick={() => openDeleteStudentModal(currentStudent)} className="w-full sm:w-auto">
              <Trash2 className="mr-2 h-4 w-4" /> Delete Student
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <CardTitle className="flex items-center gap-2"><Target className="text-primary" /> Assigned Goals ({currentStudent.goals.length})</CardTitle>
          <Button size="sm" onClick={() => setIsAssignGoalModalOpen(true)} className="w-full sm:w-auto mt-2 sm:mt-0">
            <PlusCircle className="mr-2 h-4 w-4" /> Assign / Create Goal
          </Button>
        </CardHeader>
        <CardContent>
          {currentStudent.goals.length === 0 ? (
            <p className="text-muted-foreground">No goals assigned to this student yet. Click "Assign / Create Goal" to add one.</p>
          ) : (
            <ul className="space-y-4">
              {currentStudent.goals.map((goal) => (
                <li key={goal.id} className="p-4 border rounded-lg shadow-sm bg-card hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row justify-between items-start">
                    <div className="flex-grow">
                      <h3 className="text-lg font-semibold text-primary">{goal.name}</h3>
                      <Badge variant="secondary" className="mt-1">{goal.type.replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</Badge>
                      {goal.sessionTargetValue !== undefined && (
                        <Badge variant="outline" className="mt-1 ml-0 sm:ml-2">
                          <TrendingUp className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                          Target: {goal.sessionTargetValue}{goal.type !== 'QUALITATIVE_OBSERVATION' ? '%' : ''}
                        </Badge>
                      )}
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{goal.smartGoal}</p>
                    </div>
                    <div className="flex gap-1 shrink-0 mt-2 sm:mt-0 sm:ml-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditAssignedGoalModal(goal)} title="Edit Assigned Goal">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveGoal(goal.id)} title="Remove Goal Assignment">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t">
                     <Link href={`/data-entry?studentId=${currentStudent.id}&goalId=${goal.id}`}
                           className="inline-flex items-center text-sm text-primary hover:underline">
                        <CheckSquare className="mr-2 h-4 w-4" /> Enter/View Progress Data
                     </Link>
                  </div>
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

