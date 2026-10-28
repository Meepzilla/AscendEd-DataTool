'use client';

import React from 'react';
import Link from 'next/link';
import type { Student } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDate, studentProfilePath } from '@/lib/helpers';

interface StudentSelectionCardProps {
  student: Student;
}

const StudentSelectionCard: React.FC<StudentSelectionCardProps> = ({ student }) => {
  return (
    <Link href={studentProfilePath(student.id)} passHref>
      <Card className="h-full flex flex-col justify-center items-center text-center p-4 transition-all duration-200 ease-in-out hover:shadow-xl hover:ring-2 hover:ring-primary focus-visible:ring-2 focus-visible:ring-primary">
        <CardHeader className="p-2">
          <Avatar className="h-20 w-20 mx-auto">
            <AvatarImage 
              src={`https://avatar.vercel.sh/${student.id}.png?text=${student.name.substring(0, 2).toUpperCase()}`} 
              alt={student.name}
              data-ai-hint="abstract avatar"
            />
            <AvatarFallback>{student.name.substring(0, 2).toUpperCase()}</AvatarFallback>
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
  );
};

export default StudentSelectionCard;
