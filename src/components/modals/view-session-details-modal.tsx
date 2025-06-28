'use client';

import React from 'react';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import type { SessionData, Goal } from '@/lib/types';
import { formatDate, formatTime } from '@/lib/helpers';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, CalendarDays, Clock, FileText, Target, CheckSquare, Info } from 'lucide-react';

interface ViewSessionDetailsModalProps {
  session: SessionData | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ViewSessionDetailsModal({ session, isOpen, onClose }: ViewSessionDetailsModalProps) {
  if (!session) return null;

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Session Details: ${session.studentName}`}
      description={`Review the recorded data for the session on ${formatDate(session.date)} at ${formatTime(session.date)}. `}
      size="xl"
    >
      <div>
        {/* The outer ScrollArea was removed. The GenericModal itself provides scrolling for its content. */}
        <div className="space-y-6">
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2"><Activity className="h-6 w-6 text-primary"/>Session Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-muted-foreground"/>
                <strong>Date:</strong> {formatDate(session.date)}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground"/>
                <strong>Time:</strong> {session.time}
              </div>
              <div className="md:col-span-2 flex items-start gap-2">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5"/>
                <div>
                    <strong>Activity:</strong>
                    <p className="text-foreground">{session.activity || "N/A"}</p>
                </div>
              </div>
              <div className="md:col-span-2 flex items-start gap-2">
                 <Info className="h-5 w-5 text-muted-foreground mt-0.5"/>
                 <div>
                    <strong>General Notes:</strong>
                    <p className="text-foreground whitespace-pre-wrap">{session.notes || "No general notes."}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Target className="h-5 w-5 text-primary"/>Goal Data</h3>
            {session.goals.length === 0 ? (
              <p className="text-muted-foreground">No goal-specific data recorded for this session.</p>
            ) : (
              <div className="space-y-4">
                {session.goals.map((goalData) => {
                  const originalGoal = session.originalGoalHeaders.find(og => og.id === goalData.goalId);
                  return (
                    <Card key={goalData.goalId} className="overflow-hidden">
                      <CardHeader className="bg-card p-3">
                        <div className="flex justify-between items-center">
                           <h4 className="font-semibold text-md text-primary">{goalData.goalName}</h4>
                           <Badge variant="secondary">{goalData.goalType.replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</Badge>
                        </div>
                        {originalGoal?.smartGoal && <CardDescription className="text-xs mt-1 line-clamp-2">{originalGoal.smartGoal}</CardDescription>}
                      </CardHeader>
                      <CardContent className="p-3 text-sm space-y-1">
                        {Object.entries(goalData.data).map(([key, value]) => (
                          <div key={key} className="flex justify-between items-center">
                            <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                            <span className="font-medium text-foreground text-right">
                                {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                            </span>
                          </div>
                        ))}
                         {Object.keys(goalData.data).length === 0 && <p className="text-xs text-muted-foreground">No specific data points recorded for this goal.</p>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </GenericModal>
  );
}
