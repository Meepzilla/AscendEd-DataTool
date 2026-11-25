'use client';

import React from 'react';
import type { Student } from '@/lib/types';
import StudentSelectionCard from './StudentSelectionCard';

interface StudentSelectionGridProps {
  students: Student[];
}

const StudentSelectionGrid: React.FC<StudentSelectionGridProps> = ({ students }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {students.map(student => (
        <StudentSelectionCard key={student.id} student={student} />
      ))}
    </div>
  );
};

export default StudentSelectionGrid;
