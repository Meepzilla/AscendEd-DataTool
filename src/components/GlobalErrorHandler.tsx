'use client';

import { useEffect } from 'react';
import { useErrorLog } from '@/hooks/use-error-log';
import { installGlobalErrorHandlers } from '@/lib/global-error-handler';

// Installs the window error and unhandled-rejection handlers once per page load (see
// lib/global-error-handler.ts). Renders nothing. Lives inside ErrorLogProvider, so uncaught
// errors land in the in-memory error log instead of vanishing.
export default function GlobalErrorHandler() {
  const { addErrorLog } = useErrorLog();
  useEffect(() => installGlobalErrorHandlers(window, log => addErrorLog(log)), [addErrorLog]);
  return null;
}
