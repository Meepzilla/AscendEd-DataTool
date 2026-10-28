import { z } from 'zod';
import type { GoalTemplate, SessionData, Student } from './types';
import { AbcListsSchema, type AbcLists } from './abc-lists';

// A backup holds everything stored on the device: students (with their goals),
// goal templates, sessions, and edited settings that belong with the data (the ABC data lists).
// It is a JSON file the user saves and can restore later.

export const BACKUP_VERSION = 1;
const BACKUP_APP = 'AscendEd';
export const LAST_BACKUP_KEY = 'ascended_last_backup_at';

export interface BackupData {
  students: Student[];
  goalTemplates: GoalTemplate[];
  sessions: SessionData[];
}

export interface BackupSettings {
  abcLists?: AbcLists; // only when edited on the device
}

export interface AppBackup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: BackupData;
  settings?: BackupSettings;
}

export type RestoreMode = 'merge' | 'replace';

// Only the fields restore relies on are checked; everything else is kept as-is.
const BackupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.number().int(),
  exportedAt: z.string(),
  data: z.object({
    students: z.array(z.object({ id: z.string(), name: z.string(), goals: z.array(z.any()) }).passthrough()),
    goalTemplates: z.array(z.object({ id: z.string(), name: z.string(), type: z.string() }).passthrough()),
    sessions: z.array(z.object({ sessionId: z.string(), studentId: z.string(), date: z.string() }).passthrough()),
  }),
  // Settings that don't validate are dropped rather than rejecting the whole backup.
  settings: z.object({ abcLists: AbcListsSchema.optional().catch(undefined) }).optional().catch(undefined),
});

export function createBackup(data: BackupData, settings: BackupSettings = {}): AppBackup {
  const backup: AppBackup = { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
  if (settings.abcLists) backup.settings = settings;
  return backup;
}

export function backupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `AscendEd-backup_${stamp}.json`;
}

/**
 * Parses and validates a backup file's text. Throws an Error with a message suitable for the user.
 */
export function parseBackup(text: string): AppBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('This file is not an AscendEd backup (it is not valid JSON).');
  }
  const result = BackupSchema.safeParse(json);
  if (!result.success) {
    throw new Error('This file is not an AscendEd backup, or it is damaged.');
  }
  if (result.data.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of AscendEd. Update the app and try again.');
  }
  const { data } = result.data;
  return {
    ...result.data,
    data: {
      students: data.students as unknown as Student[],
      // Template dates are stored as strings in JSON; the app works with Date objects.
      goalTemplates: (data.goalTemplates as unknown as GoalTemplate[]).map(t => ({ ...t, createdAt: new Date(t.createdAt) })),
      sessions: data.sessions as unknown as SessionData[],
    },
  } as AppBackup;
}

export interface RestoreSummary {
  students: number;
  goalTemplates: number;
  sessions: number;
}

/**
 * Combines a backup with the data already on the device. Records already present (same id)
 * keep the device's version, so restoring the same backup twice adds nothing. Built-in default
 * templates are matched by name, because every device creates them with its own ids.
 */
export function mergeBackupData(current: BackupData, incoming: BackupData): { merged: BackupData; added: RestoreSummary } {
  const studentIds = new Set(current.students.map(s => s.id));
  const newStudents = incoming.students.filter(s => !studentIds.has(s.id));

  const templateIds = new Set(current.goalTemplates.map(t => t.id));
  const defaultNames = new Set(current.goalTemplates.filter(t => t.isDefault).map(t => t.name));
  const newTemplates = incoming.goalTemplates.filter(t => !templateIds.has(t.id) && !(t.isDefault && defaultNames.has(t.name)));

  const sessionIds = new Set(current.sessions.map(s => s.sessionId));
  const newSessions = incoming.sessions.filter(s => !sessionIds.has(s.sessionId));

  return {
    merged: {
      students: [...current.students, ...newStudents],
      goalTemplates: [...current.goalTemplates, ...newTemplates],
      sessions: [...current.sessions, ...newSessions],
    },
    added: { students: newStudents.length, goalTemplates: newTemplates.length, sessions: newSessions.length },
  };
}
