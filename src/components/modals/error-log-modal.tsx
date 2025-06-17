
'use client';

import React from 'react';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useErrorLog, type AppErrorLogEntry } from '@/hooks/use-error-log'; // Import from new hook
import { AlertTriangle, Info, Trash2 } from 'lucide-react';

// ErrorLogModalProps is no longer needed as isOpen/onClose are handled by useErrorLog
// interface ErrorLogModalProps {
//   isOpen: boolean;
//   onClose: () => void;
// }

export default function ErrorLogModal() {
  const { errorLogs, clearErrorLogs, isErrorLogModalOpen, toggleErrorLogModal } = useErrorLog();

  return (
    <GenericModal
      isOpen={isErrorLogModalOpen}
      onClose={toggleErrorLogModal} // Use toggleErrorLogModal for closing
      title="Application Error Log"
      description="Recent errors and warnings. For detailed debugging, check browser console."
      size="xl"
    >
      <div className="space-y-4">
        <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-muted/30">
          {errorLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No errors or warnings logged recently.</p>
          ) : (
            <ul className="space-y-3">
              {errorLogs.map(log => (
                <li key={log.id} className="p-3 rounded-md bg-card border shadow-sm">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-start gap-2">
                        {log.type === 'error' && <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />}
                        {log.type === 'warning' && <Info className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />}
                        <div>
                            <p className={`font-semibold ${
                            log.type === 'error' ? 'text-destructive' : 
                            log.type === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-500'
                            }`}>
                            {log.message}
                            </p>
                             {log.source && <p className="text-xs text-muted-foreground">Source: {log.source}</p>}
                        </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {log.timestamp.toLocaleString()}
                    </span>
                  </div>
                  {log.details && <p className="text-sm text-muted-foreground mt-1 pl-4 border-l-2 border-border ml-1 whitespace-pre-wrap">{log.details}</p>}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">Displaying last {errorLogs.length} of max 50 logs.</p>
            <div className="flex gap-2">
                <Button variant="outline" onClick={clearErrorLogs} disabled={errorLogs.length === 0}>
                    <Trash2 className="mr-2 h-4 w-4"/> Clear Logs
                </Button>
                <Button onClick={toggleErrorLogModal}>Close</Button>
            </div>
        </div>
      </div>
    </GenericModal>
  );
}
