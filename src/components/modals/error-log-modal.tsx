'use client';

import React, { useState, useEffect } from 'react';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ErrorLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  details?: string;
  type: 'error' | 'warning' | 'info';
}

// Placeholder for a global error logging service/store
const getErrorLogs = (): LogEntry[] => {
  // In a real app, this would fetch from a state management store or service
  return [
    { id: '1', timestamp: new Date(), message: 'Failed to fetch student data.', details: 'Network timeout after 15s.', type: 'error' },
    { id: '2', timestamp: new Date(Date.now() - 60000 * 5), message: 'AI suggestion service unavailable.', type: 'warning' },
    { id: '3', timestamp: new Date(Date.now() - 60000 * 10), message: 'User signed in anonymously.', type: 'info' },
  ];
};

export default function ErrorLogModal({ isOpen, onClose }: ErrorLogModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (isOpen) {
      setLogs(getErrorLogs());
    }
  }, [isOpen]);

  const clearLogs = () => {
    // Placeholder: In a real app, dispatch an action to clear logs
    setLogs([]);
    alert("Logs cleared (placeholder action).");
  }

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title="Application Error Log"
      description="Recent errors and warnings. For detailed debugging, check browser console."
      size="xl"
    >
      <div className="space-y-4">
        <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-muted/30">
          {logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No errors or warnings logged recently.</p>
          ) : (
            <ul className="space-y-3">
              {logs.map(log => (
                <li key={log.id} className="p-3 rounded-md bg-card border shadow-sm">
                  <div className="flex justify-between items-start">
                    <p className={`font-semibold ${
                      log.type === 'error' ? 'text-destructive' : 
                      log.type === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                    }`}>
                      {log.type.toUpperCase()}: {log.message}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {log.timestamp.toLocaleString()}
                    </span>
                  </div>
                  {log.details && <p className="text-sm text-muted-foreground mt-1 pl-2 border-l-2 border-border ml-1">{log.details}</p>}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={clearLogs} disabled={logs.length === 0}>Clear Logs</Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </GenericModal>
  );
}
