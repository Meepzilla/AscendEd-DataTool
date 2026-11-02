'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStudentData } from '@/hooks/use-student-data';
import { goalTypeLabel } from '@/lib/helpers';

// Built-in goals the user deleted from the Goals library. Restoring one puts it back in the library and the picker.
export default function BuiltInGoalsCard() {
  const { deletedBuiltInTemplates, restoreBuiltInTemplates } = useStudentData();
  const count = deletedBuiltInTemplates.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Built-in goals</CardTitle>
        <CardDescription>
          {count === 0
            ? 'No built-in goals are deleted. Delete one from the Goals page; it is listed here so you can restore it.'
            : `${count} built-in goal${count === 1 ? ' is' : 's are'} deleted from the Goals library and the goal picker.`}
        </CardDescription>
      </CardHeader>
      {count > 0 && (
        <CardContent className="space-y-3">
          <Button variant="outline" size="sm" onClick={() => void restoreBuiltInTemplates(deletedBuiltInTemplates.map(t => t.id))}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden /> Restore all {count}
          </Button>
          <ul className="max-h-80 space-y-1 overflow-y-auto pr-1">
            {deletedBuiltInTemplates.map(template => (
              <li key={template.id} className="flex items-center gap-2 rounded border px-2 py-1 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block break-words">{template.name}</span>
                  <span className="block text-xs text-muted-foreground">{goalTypeLabel(template.type)}</span>
                </span>
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => void restoreBuiltInTemplates([template.id])} aria-label={`Restore ${template.name}`}>
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
