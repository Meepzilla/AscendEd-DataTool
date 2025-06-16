
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, Goal, GoalTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, Trash2, PlusCircle, Info, Target, Edit3, CheckSquare } from 'lucide-react';
import { formatDate, generateUUID } from '@/lib/helpers'; // Added generateUUID
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import EditStudentModal from '@/components/modals/edit-student-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import AssignGoalToStudentModal from '@/components/modals/assign-goal-to-student-modal';
// Removed EditGoalModal import as it's not directly used for editing *assigned* goals here.
// If individual goal editing is needed, a new modal/flow would be created.


export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;

  const { 
    students, 
    loading, 
    error,
    isFirebaseDBAvailable, 
    selectedStudent, 
    setSelectedStudent, 
    openEditStudentModal, 
    openDeleteStudentModal,
    removeGoalFromStudent,
    updateStudentGoal, // Keep for potential future direct edit of assigned goal's SMART text
  } = useStudentData();

  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [isAssignGoalModalOpen, setIsAssignGoalModalOpen] = useState(false);
  // const [editingGoal, setEditingGoal] = useState<Goal | null>(null); // Removed: Not used for direct edit now.

  useEffect(() => {
    const foundStudent = students.find(s => s.id === studentId);
    if (foundStudent) {
      setCurrentStudent(foundStudent);
      if (!selectedStudent || selectedStudent.id !== foundStudent.id) {
        setSelectedStudent(foundStudent);
      }
    } else if (!loading && students.length > 0 && studentId) {
      // router.push('/student-profile'); // Avoid redirecting if studentId simply not found yet
    }
  }, [studentId, students, loading, selectedStudent, setSelectedStudent, router]);


  if (loading && !currentStudent) { // Only show full skeleton if currentStudent isn't set yet due to loading
    return <StudentProfileSkeleton />;
  }

  if (!isFirebaseDBAvailable && !loading && !currentStudent && students.length === 0) {
      // Special case for local mode with no students yet, guide user.
      return (
          <Card className="mt-4">
            <CardHeader><CardTitle>No Students</CardTitle></CardHeader>
            <CardContent>
                <p>No students found in local mode. Please add a student first.</p>
                <Button onClick={() => router.push('/dashboard')} className="mt-4">Go to Dashboard</Button>
            </CardContent>
          </Card>
      )
  }
  
  if (error) { 
    return <div className="text-destructive p-4">Error loading student data: {error.message}</div>;
  }
  
  if (!currentStudent && !loading) { 
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Info className="text-destructive"/>Student Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p>The student with ID "{studentId}" could not be found. They may have been deleted or the ID is incorrect.</p>
          {!isFirebaseDBAvailable && <p className="text-orange-500 font-semibold mt-2">(Operating in Local Mode)</p>}
          <Button onClick={() => router.push('/student-profile')} className="mt-4">Go to Student Selection</Button>
        </CardContent>
      </Card>
    );
  }
  
  // This ensures we don't try to render with a null currentStudent if it's just loading
  if (!currentStudent) {
    return <StudentProfileSkeleton />;
  }
  
  const handleRemoveGoal = async (goalId: string) => {
    await removeGoalFromStudent(currentStudent.id, goalId);
  };

  // Placeholder if direct editing of an assigned goal's details (like SMART text) is needed later.
  // For now, goals are managed through templates or assignment modal.
  const handleEditGoalDirectly = (goal: Goal) => {
    // setEditingGoal(goal); // This would trigger a modal for editing goal.smartGoal, etc.
    alert(`Direct editing of goal "${goal.name}"'s SMART text is not yet implemented. Manage via templates or re-assign.`);
  }


  return (
    <div className="space-y-6">
      {/* EditStudentModal is for student's name, not their goals directly */}
      {editingStudent && <EditStudentModal studentToEdit={editingStudent} />} 

      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={`https://avatar.vercel.sh/${currentStudent.id}.png?text=${currentStudent.name.substring(0,2).toUpperCase()}`} alt={currentStudent.name} data-ai-hint="abstract avatar"/>
              <AvatarFallback>{currentStudent.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-3xl font-bold">{currentStudent.name}</CardTitle>
              <CardDescription>
                Student ID: {currentStudent.id} | Joined: {formatDate(currentStudent.createdAt)}
                {!isFirebaseDBAvailable && !loading && <span className="text-orange-500 font-semibold block">(Local Mode)</span>}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2 mt-2 sm:mt-0">
            <Button variant="outline" size="sm" onClick={() => openEditStudentModal(currentStudent)}>
              <Edit3 className="mr-2 h-4 w-4" /> Edit Student Info
            </Button>
            <Button variant="destructive"  size="sm" onClick={() => openDeleteStudentModal(currentStudent)}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete Student
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle className="flex items-center gap-2"><Target className="text-primary" /> Assigned Goals ({currentStudent.goals.length})</CardTitle>
          <Button size="sm" onClick={() => setIsAssignGoalModalOpen(true)}>
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
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-primary">{goal.name}</h3>
                      <Badge variant="secondary" className="mt-1">{goal.type.replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</Badge>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{goal.smartGoal}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-1 shrink-0 ml-2">
                      {/* <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditGoalDirectly(goal)} title="Edit Goal SMART Text">
                        <Edit className="h-4 w-4" />
                      </Button> */}
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
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="flex gap-2 mt-2 sm:mt-0">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-32" />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-9 w-36" />
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

        