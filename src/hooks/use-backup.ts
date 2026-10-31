'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStudentData } from './use-student-data';
import { useToast } from './use-toast';
import { useErrorLog } from './use-error-log';
import { backupFileName, backupFileText, LAST_BACKUP_KEY } from '@/lib/backup';
import { saveTextFile } from '@/lib/save-file';
import { plural } from '@/lib/helpers';

const BACKUP_SAVED_EVENT = 'ascended-backup-saved';

const readLastBackup = (): Date | null => {
  try {
    const value = window.localStorage.getItem(LAST_BACKUP_KEY);
    return value ? new Date(value) : null;
  } catch {
    return null;
  }
};

/**
 * Backs up all data on this device to a file, and tracks when the last backup was made.
 */
export function useBackup() {
  const { exportBackup, error: dataError } = useStudentData();
  const { toast } = useToast();
  const { addErrorLog } = useErrorLog();
  const [lastBackupAt, setLastBackupAt] = useState<Date | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Every place showing the last backup (Settings, the dashboard reminder) updates when one is saved.
  useEffect(() => {
    const read = () => setLastBackupAt(readLastBackup());
    read();
    window.addEventListener(BACKUP_SAVED_EVENT, read);
    return () => window.removeEventListener(BACKUP_SAVED_EVENT, read);
  }, []);

  /** Saves a backup file; with a password, the file is encrypted with it. Returns whether it was saved. */
  const backUpNow = useCallback(async (password?: string): Promise<boolean> => {
    setIsBackingUp(true);
    try {
      const backup = exportBackup();
      const saved = await saveTextFile(backupFileName(), await backupFileText(backup, password));
      if (!saved) return false;
      if (dataError) {
        // Part of the stored data couldn't be read, so this backup is incomplete: the reminder stays on, and an
        // older full backup should be kept rather than replaced by this one.
        toast({
          title: 'Backup is incomplete',
          description: "Some of this device's data couldn't be read, so it isn't in this backup. Keep your earlier backup files.",
          variant: 'destructive',
        });
        return true;
      }
      window.localStorage.setItem(LAST_BACKUP_KEY, backup.exportedAt);
      window.dispatchEvent(new Event(BACKUP_SAVED_EVENT));
      toast({ title: 'Backup saved', description: `${plural(backup.data.students.length, 'student')} and ${plural(backup.data.sessions.length, 'session')} backed up${password ? ', protected with your password' : ''}.` });
      return true;
    } catch (error: any) {
      addErrorLog({ message: 'Backup failed.', source: 'useBackup.backUpNow', details: error?.message, type: 'error' });
      toast({ title: 'Backup failed', description: error?.message || 'The backup file could not be saved.', variant: 'destructive' });
      return false;
    } finally {
      setIsBackingUp(false);
    }
  }, [exportBackup, dataError, toast, addErrorLog]);

  return { lastBackupAt, backUpNow, isBackingUp };
}
