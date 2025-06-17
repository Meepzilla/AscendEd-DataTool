
'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { generateUUID } from '@/lib/helpers';

export interface AppErrorLogEntry {
  id: string;
  timestamp: Date;
  message: string;
  source?: string;
  details?: string;
  type: 'error' | 'warning';
}

interface ErrorLogContextType {
  errorLogs: AppErrorLogEntry[];
  addErrorLog: (log: Omit<AppErrorLogEntry, 'id' | 'timestamp'>) => void;
  clearErrorLogs: () => void;
  isErrorLogModalOpen: boolean;
  toggleErrorLogModal: () => void;
  openErrorLogModal: () => void;
}

const ErrorLogContext = createContext<ErrorLogContextType | undefined>(undefined);

export const ErrorLogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [errorLogs, setErrorLogs] = useState<AppErrorLogEntry[]>([]);
  const [isErrorLogModalOpen, setIsErrorLogModalOpen] = useState(false);

  const addErrorLog = useCallback((log: Omit<AppErrorLogEntry, 'id' | 'timestamp'>) => {
    const newLogEntry: AppErrorLogEntry = {
      ...log,
      id: generateUUID(),
      timestamp: new Date(),
    };
    setErrorLogs(prevLogs => [newLogEntry, ...prevLogs].slice(0, 50)); // Keep last 50 logs
    console.error(`Error Logged [${log.type}]: ${log.message}`, {source: log.source, details: log.details});
  }, []);

  const clearErrorLogs = useCallback(() => {
    setErrorLogs([]);
  }, []);

  const toggleErrorLogModal = useCallback(() => {
    setIsErrorLogModalOpen(prev => !prev);
  }, []);

  const openErrorLogModal = useCallback(() => {
    setIsErrorLogModalOpen(true);
  }, []);

  return (
    <ErrorLogContext.Provider value={{ errorLogs, addErrorLog, clearErrorLogs, isErrorLogModalOpen, toggleErrorLogModal, openErrorLogModal }}>
      {children}
    </ErrorLogContext.Provider>
  );
};

export const useErrorLog = (): ErrorLogContextType => {
  const context = useContext(ErrorLogContext);
  if (!context) {
    throw new Error('useErrorLog must be used within an ErrorLogProvider');
  }
  return context;
};
