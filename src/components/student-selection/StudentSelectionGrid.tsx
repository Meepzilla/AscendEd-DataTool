'use client';

import React from 'react';
import Link from 'next/link';
import type { Student } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDate, studentProfilePath } from '@/lib/helpers';

interface StudentSelectionGridProps {
  students: Student[];
}

const StudentSelectionGrid: React.FC<StudentSelectionGridProps> = ({ students }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {students.map(student => (
        <Link key={student.id} href={studentProfilePath(student.id)} passHref>
          <Card className="h-full flex flex-col justify-center items-center text-center p-4 transition-all duration-200 ease-in-out hover:shadow-xl hover:ring-2 hover:ring-primary focus-visible:ring-2 focus-visible:ring-primary">
            <CardHeader className="p-2">
              <Avatar className="h-20 w-20 mx-auto">
                <AvatarFallback className="bg-primary/15 text-primary text-2xl font-semibold">
                  {student.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </CardHeader>
            <CardContent className="p-2">
              <CardTitle className="text-lg font-semibold">{student.name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Joined: {formatDate(student.createdAt)}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
};

export default StudentSelectionGrid;
