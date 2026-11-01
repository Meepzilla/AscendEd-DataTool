
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useStudentData } from '@/hooks/use-student-data';
import { StudentSchema } from '@/lib/types'; // Assuming you have Zod schemas defined in types.ts

type AddStudentFormData = z.infer<typeof StudentSchema>;

export default function AddStudentModal() {
  const { isAddStudentModalOpen, closeAddStudentModal, addStudent, loading: dataLoading } = useStudentData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<AddStudentFormData>({
    resolver: zodResolver(StudentSchema),
    defaultValues: {
      name: '',
    },
  });
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAddStudentModalOpen) {
      form.reset(); // Reset form on open
      // Auto-focus on name field when opened
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [isAddStudentModalOpen, form]);

  const onSubmit = async (data: AddStudentFormData) => {
    setIsSubmitting(true);
    const newStudent = await addStudent(data.name);
    setIsSubmitting(false);
    if (newStudent) {
      closeAddStudentModal();
    }
    // Error handling is done within addStudent via toast
  };

  return (
    <GenericModal
      isOpen={isAddStudentModalOpen}
      onClose={closeAddStudentModal}
      title="Add New Student"
      description="Enter the student's name to add them to your records."
    >
      <Form {...form}>
        <form 
          onSubmit={form.handleSubmit(onSubmit)} 
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit(onSubmit)();
            }
          }}
          className="space-y-6"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="studentName">Student Name</FormLabel>
                <FormControl>
                  <Input 
                    id="studentName" 
                    placeholder="e.g., John Doe" 
                    {...field} 
                    ref={nameInputRef} 
                    aria-required="true"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <p className="text-sm text-muted-foreground">
            Adding several students with IEP dates and goals?{' '}
            <Link href="/settings#import-students" className="underline hover:text-primary" onClick={closeAddStudentModal}>
              Import them from a spreadsheet
            </Link>.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeAddStudentModal} disabled={isSubmitting || dataLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || dataLoading}>
              {isSubmitting || dataLoading ? 'Adding...' : 'Add Student'}
            </Button>
          </div>
        </form>
      </Form>
    </GenericModal>
  );
}
