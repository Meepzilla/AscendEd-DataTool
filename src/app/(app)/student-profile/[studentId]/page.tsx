
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, Goal, GoalTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, Trash2, PlusCircle, Info, Target, Edit3, CheckSquare, TrendingUp, Archive, ArchiveRestore } from 'lucide-react';
import { formatDate, generateUUID } from '@/lib/helpers'; 
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

import AssignGoalToStudentModal from '@/components/modals/assign-goal-to-student-modal';
import EditAssignedGoalModal from '@/components/modals/edit-assigned-goal-modal';
import ConfirmationModal from '@/components/modals/confirmation-modal';


export default function StudentProfilePage({ params }: { params: { studentId?: string } }) {
  const studentIdFromParams = params.studentId;
  const router = useRouter();
  
  const {
    students,
    loading, 
    error,
    isFirebaseDBAvailable,
    selectedStudent,
    setSelectedStudent,
    openEditStudentModal, 
    deletingStudent, 
    openDeleteStudentModal, 
    closeDeleteStudentModal, 
    removeGoalFromStudent,
    editingAssignedGoal, 
    openEditAssignedGoalModal, 
    closeEditAssignedGoalModal, 
    updateStudentGoal,
  } = useStudentData();

  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [isAssignGoalModalOpen, setIsAssignGoalModalOpen] = useState(false);

  useEffect(() => {
    if (studentIdFromParams) {
      const foundStudent = students.find(s => s.id === studentIdFromParams);
      if (foundStudent) {
        setCurrentStudent(foundStudent);
        if (!selectedStudent || selectedStudent.id !== foundStudent.id) {
          setSelectedStudent(foundStudent);
        }
      } else if (!loading && students.length > 0) {
        setCurrentStudent(null); 
      }
    } else if (studentIdFromParams === undefined && !loading) {
      setCurrentStudent(null);
    }
  }, [studentIdFromParams, students, loading, selectedStudent, setSelectedStudent]);


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
          <p>The student with ID "{studentIdDisplay}" could not be found. They may have been deleted or the ID is incorrect.</p>
          {!isFirebaseDBAvailable && <p className="text-orange-500 font-semibold mt-2">(Operating in Local Mode)</p>}
          <Button onClick={() => router.push('/student-profile')} className="mt-4">Go to Student Selection</Button>
        </CardContent>
      </Card>
    );
  }
  
  if (!currentStudent) {
    return <StudentProfileSkeleton />; 
  }


  const handleRemoveGoal = async (goalId: string) => {
    if (currentStudent) { 
        await removeGoalFromStudent(currentStudent.id, goalId);
    }
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


  return (
    <div className="space-y-6">
      {editingAssignedGoal && currentStudent && (
        <EditAssignedGoalModal
          isOpen={!!editingAssignedGoal}
          onClose={closeEditAssignedGoalModal}
          studentId={editingAssignedGoal.studentId} 
          goalToEdit={editingAssignedGoal.goal}
        />
      )}

      {deletingStudent && (
        <ConfirmationModal
          isOpen={!!deletingStudent}
          onClose={closeDeleteStudentModal}
          title={`Delete Student: ${deletingStudent.name}`}
          description="Are you sure you want to delete this student and all their associated session data? This action cannot be undone."
          itemToDelete={deletingStudent}
          deleteActionType="student"
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
          <CardTitle className="flex items-center gap-2"><Target className="text-primary" /> Assigned Goals ({currentStudent.goals.filter(g => !g.isArchived).length} Active / {currentStudent.goals.length} Total)</CardTitle>
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
                <li key={goal.id} className={`p-4 border rounded-lg shadow-sm bg-card hover:shadow-md transition-shadow ${goal.isArchived ? 'opacity-60 bg-muted/50' : ''}`}>
                  <div className="flex flex-col sm:flex-row justify-between items-start">
                    <div className="flex-grow">
                      <h3 className="text-lg font-semibold text-primary">{goal.name}</h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge variant="secondary">{goal.type.replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</Badge>
                        {goal.sessionTargetValue !== undefined && (
                          <Badge variant="outline">
                            <TrendingUp className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                            Target: {goal.sessionTargetValue}{goal.type !== 'QUALITATIVE_OBSERVATION' ? '%' : ''}
                          </Badge>
                        )}
                        {goal.isArchived && <Badge variant="outline" className="border-orange-500 text-orange-600">Archived</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{goal.smartGoal}</p>
                    </div>
                    <div className="flex gap-1 shrink-0 mt-2 sm:mt-0 sm:ml-2">
                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleArchiveGoal(goal)} title={goal.isArchived ? "Unarchive Goal" : "Archive Goal"}>
                        {goal.isArchived ? <ArchiveRestore className="h-4 w-4 text-green-600" /> : <Archive className="h-4 w-4 text-orange-600" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditAssignedGoalModal(goal)} title="Edit Assigned Goal">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveGoal(goal.id)} title="Remove Goal Assignment">
                        <Trash2 className="h-4 w-4 text-destructive" />
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
    

    
