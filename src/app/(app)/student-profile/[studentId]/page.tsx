'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, Goal, GoalTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, Trash2, PlusCircle, Info, Target, Edit3, CheckSquare } from 'lucide-react';
import { formatDate } from '@/lib/helpers';
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
import AssignGoalToStudentModal from '@/components/modals/assign-goal-to-student-modal'; // To be created


export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;

  const { 
    students, 
    loading, 
    error, 
    selectedStudent, 
    setSelectedStudent, 
    openEditStudentModal, 
    openDeleteStudentModal,
    removeGoalFromStudent,
    updateStudentGoal, // Placeholder for editing a goal directly
  } = useStudentData();

  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [isAssignGoalModalOpen, setIsAssignGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null); // Placeholder for editing goal

  useEffect(() => {
    const foundStudent = students.find(s => s.id === studentId);
    if (foundStudent) {
      setCurrentStudent(foundStudent);
      if (!selectedStudent || selectedStudent.id !== foundStudent.id) {
        setSelectedStudent(foundStudent);
      }
    } else if (!loading && students.length > 0) {
      // If studentId is invalid or not found, but other students exist,
      // redirect to the general student profile page or select first student.
      // router.push('/student-profile');
    }
  }, [studentId, students, loading, selectedStudent, setSelectedStudent, router]);


  if (loading) {
    return <StudentProfileSkeleton />;
  }

  if (error) {
    return <div className="text-destructive p-4">Error loading student data: {error.message}</div>;
  }

  if (!currentStudent) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Info className="text-destructive"/>Student Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p>The student with ID "{studentId}" could not be found. They may have been deleted or the ID is incorrect.</p>
          <Button onClick={() => router.push('/student-profile')} className="mt-4">Go to Student Selection</Button>
        </CardContent>
      </Card>
    );
  }
  
  const handleRemoveGoal = async (goalId: string) => {
    // Confirmation could be added here
    await removeGoalFromStudent(currentStudent.id, goalId);
  };

  // Placeholder for editing goal directly on profile page
  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    alert(`Editing goal "${goal.name}" - implement EditGoalModal or inline editing.`);
    // Example: openEditGoalModal(goal);
  }


  return (
    <div className="space-y-6">
      <EditStudentModal studentToEdit={currentStudent} /> 
      {/* Delete modal is handled by StudentSidebar/useStudentData context */}

      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={`https://avatar.vercel.sh/${currentStudent.id}.png`} alt={currentStudent.name} />
              <AvatarFallback>{currentStudent.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-3xl font-bold">{currentStudent.name}</CardTitle>
              <CardDescription>Student ID: {currentStudent.id} | Joined: {formatDate(currentStudent.createdAt)}</CardDescription>
            </div>
          </div>
          <div className="flex gap-2 mt-2 sm:mt-0">
            <Button variant="outline" size="sm" onClick={() => openEditStudentModal(currentStudent)}>
              <Edit3 className="mr-2 h-4 w-4" /> Edit Student
            </Button>
            <Button variant="destructive" outline size="sm" onClick={() => openDeleteStudentModal(currentStudent)}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete Student
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle className="flex items-center gap-2"><Target className="text-primary" /> Assigned Goals</CardTitle>
          <Button size="sm" onClick={() => setIsAssignGoalModalOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Assign New Goal
          </Button>
        </CardHeader>
        <CardContent>
          {currentStudent.goals.length === 0 ? (
            <p className="text-muted-foreground">No goals assigned to this student yet.</p>
          ) : (
            <ul className="space-y-4">
              {currentStudent.goals.map((goal) => (
                <li key={goal.id} className="p-4 border rounded-lg shadow-sm bg-card hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-primary">{goal.name}</h3>
                      <Badge variant="secondary" className="mt-1">{goal.type}</Badge>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{goal.smartGoal}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 shrink-0 ml-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditGoal(goal)} title="Edit Goal Details">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveGoal(goal.id)} title="Remove Goal">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {/* Placeholder for quick progress view or link to data entry */}
                  <div className="mt-3 pt-3 border-t">
                     <Link href={`/data-entry?studentId=${currentStudent.id}&goalId=${goal.id}`}>
                        <Button variant="link" size="sm" className="p-0 h-auto text-sm">
                           <CheckSquare className="mr-2 h-4 w-4" /> Enter/View Progress Data
                        </Button>
                     </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      
      {isAssignGoalModalOpen && (
        <AssignGoalToStudentModal
          student={currentStudent}
          isOpen={isAssignGoalModalOpen}
          onClose={() => setIsAssignGoalModalOpen(false)}
        />
      )}
      
      {/* TODO: Create EditGoalModal if needed, or handle inline editing */}
      {/* {editingGoal && <EditGoalModal goal={editingGoal} studentId={currentStudent.id} onClose={() => setEditingGoal(null)} />} */}

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
          {[1,2].map(i => (
            <div key={i} className="p-4 border rounded-lg">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/4 mb-3" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

