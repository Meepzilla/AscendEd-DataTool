
'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { generateUUID } from '@/lib/helpers';
import { sanitizeErrorMessage } from '@/lib/error-message';

// Interface defining the structure of an individual error log entry.
export interface AppErrorLogEntry {
  id: string; // Unique identifier for the log entry.
  timestamp: Date; // Date and time when the error occurred.
  message: string; // A concise message describing the error.
  source?: string; // Optional: The component or function where the error originated.
  details?: string; // Optional: More detailed information about the error.
  type: 'error' | 'warning'; // The type of log entry (error or warning).
}

// Interface defining the shape of the ErrorLogContext, specifying the values and functions it provides.
interface ErrorLogContextType {
  errorLogs: AppErrorLogEntry[]; // Array of collected error log entries.
  addErrorLog: (log: Omit<AppErrorLogEntry, 'id' | 'timestamp'>) => void; // Function to add a new error log.
  clearErrorLogs: () => void; // Function to clear all error logs.
  isErrorLogModalOpen: boolean; // State indicating if the error log modal is open.
  toggleErrorLogModal: () => void; // Function to toggle the error log modal visibility.
  openErrorLogModal: () => void; // Function to explicitly open the error log modal.
}

// Create the React Context for error logging.
const ErrorLogContext = createContext<ErrorLogContextType | undefined>(undefined);

/**
 * ErrorLogProvider component.
 * This component provides the error logging context to its children.
 * It manages the state of error logs, allows adding and clearing logs,
 * and controls the visibility of an error log modal.
 */
export const ErrorLogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State to store the array of error log entries.
  const [errorLogs, setErrorLogs] = useState<AppErrorLogEntry[]>([]);
  // State to manage the open/closed status of the error log modal.
  const [isErrorLogModalOpen, setIsErrorLogModalOpen] = useState(false);

  /**
   * Adds a new error log entry.
   * It generates a unique ID and timestamp for the log, adds it to the state (keeping only the last 50),
   * and logs a sanitised copy to the console (warning or error based on type). The raw message and
   * details stay in the in-memory log only: error text can carry student IDs and other identifiers,
   * and the console is not a safe place for them. The log itself is never transmitted.
   */
  const addErrorLog = useCallback((log: Omit<AppErrorLogEntry, 'id' | 'timestamp'>) => {
    const newLogEntry: AppErrorLogEntry = {
      ...log,
      id: generateUUID(), // Generate a unique ID for the log entry.
      timestamp: new Date(), // Set the current timestamp.
    };
    // Update errorLogs state, adding the new log and keeping only the most recent 50.
    setErrorLogs(prevLogs => [newLogEntry, ...prevLogs].slice(0, 50)); 
    
    // Log a sanitised copy to the console based on the log type; the raw entry stays in state only.
    const safeDetails = log.details ? sanitizeErrorMessage(log.details) : undefined;
    if (log.type === 'warning') {
      console.warn(`Logged [${log.type}]: ${sanitizeErrorMessage(log.message)}`, {source: log.source, details: safeDetails});
    } else {
      console.error(`Logged [${log.type}]: ${sanitizeErrorMessage(log.message)}`, {source: log.source, details: safeDetails});
    }
  }, []); // Empty dependency array means this function is memoized and doesn't change.

  /**
   * Clears all existing error logs from the state.
   */
  const clearErrorLogs = useCallback(() => {
    setErrorLogs([]);
  }, []); // Empty dependency array means this function is memoized and doesn't change.

  /**
   * Toggles the visibility of the error log modal.
   */
  const toggleErrorLogModal = useCallback(() => {
    setIsErrorLogModalOpen(prev => !prev);
  }, []); // Empty dependency array means this function is memoized and doesn't change.

  /**
   * Explicitly opens the error log modal.
   */
  const openErrorLogModal = useCallback(() => {
    setIsErrorLogModalOpen(true);
  }, []); // Empty dependency array means this function is memoized and doesn't change.

  return (
    // Provide the error log state and functions to the children components.
    <ErrorLogContext.Provider value={{ errorLogs, addErrorLog, clearErrorLogs, isErrorLogModalOpen, toggleErrorLogModal, openErrorLogModal }}>
      {children}
    </ErrorLogContext.Provider>
  );
};

/**
 * Custom hook to consume the ErrorLogContext.
 * Throws an error if used outside of an ErrorLogProvider.
 * @returns The error logging context values.
 */
export const useErrorLog = (): ErrorLogContextType => {
  const context = useContext(ErrorLogContext);
  if (!context) {
    throw new Error('useErrorLog must be used within an ErrorLogProvider');
  }
  return context;
};

/**
 * The same context, without throwing: the (app) error boundary uses this, since the provider
 * itself may be what failed. Returns undefined outside of an ErrorLogProvider.
 */
export const useErrorLogIfAvailable = (): ErrorLogContextType | undefined =>
  useContext(ErrorLogContext);
