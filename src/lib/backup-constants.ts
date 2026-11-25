// Lightweight backup constants and helpers shared by pages/components that should not pull in
// the full Zod backup parser & serializer (backup.ts) on initial load.

export const LAST_BACKUP_KEY = 'ascended_last_backup_at';

/**
 * Backups larger than this are rejected on restore, before parsing, and are not written either: a backup the app
 * could save but never restore would be worse than no backup. Written compactly, 3,000 sessions take about 5 MB.
 */
export const MAX_BACKUP_FILE_BYTES = 50 * 1024 * 1024;

/** What the user must type to confirm saving an unencrypted (plaintext) backup file. */
export const PLAINTEXT_BACKUP_ACKNOWLEDGEMENT = 'PLAINTEXT';

/** Whether the user typed the plaintext-backup confirmation word (case-insensitive, surrounding spaces ignored). */
export function isPlaintextBackupAcknowledged(input: string): boolean {
  return input.trim().toUpperCase() === PLAINTEXT_BACKUP_ACKNOWLEDGEMENT;
}
