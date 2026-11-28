import { z } from 'zod';
import { knownGoalType } from './legacy-goal-types';
import { reviveGoalTypes } from './legacy-goal-types';
import type { CustomGoalType, GoalTemplate, SessionData, Student } from './types';
import { CustomGoalTypeSchema } from './schemas';
import { parseAbcLists, type AbcLists, loadCustomAbcLists } from './abc-lists';
import { parseCommFunctions, loadCustomCommFunctions } from './comm-functions';
import type { CommFunction } from './goal-constants/communication';
import { getStudentGroups } from './student-groups';
import { getCustomGoalTypes } from './custom-goal-types';
import { hydrateLists, readList, storageKeys } from './data-store';
import { defaultTemplateKey } from './goal-constants';
import { decryptWithPassword, encryptWithPassword, type PasswordProtected } from './secure-store';
import { LAST_BACKUP_KEY, MAX_BACKUP_FILE_BYTES, PLAINTEXT_BACKUP_ACKNOWLEDGEMENT, isPlaintextBackupAcknowledged } from './backup-constants';
import { isRealDate } from './helpers';

export { LAST_BACKUP_KEY, MAX_BACKUP_FILE_BYTES, PLAINTEXT_BACKUP_ACKNOWLEDGEMENT, isPlaintextBackupAcknowledged };

// A backup holds everything stored on the device: students (with their goals),
// goal templates, sessions, and edited settings that belong with the data (the ABC data lists).
// It is a JSON file the user saves and can restore later.

export const BACKUP_VERSION = 1;
const BACKUP_APP = 'AscendEd';

export interface BackupData {
  students: Student[];
  goalTemplates: GoalTemplate[];
  sessions: SessionData[];
}

export interface BackupSettings {
  abcLists?: AbcLists; // only when edited on the device
  commFunctions?: CommFunction[]; // the communication functions list, only when edited on the device
  studentGroups?: { id: string; name: string; studentIds: string[] }[]; // saved Data Entry groups, when there are any
  customGoalTypes?: CustomGoalType[]; // user-made custom goal types, when there are any
}

export interface AppBackup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  /** SHA-256 of the canonical payload (data + settings), added when the file is written. Absent on legacy backups. */
  checksum?: string;
  data: BackupData;
  settings?: BackupSettings;
}

const TOO_LARGE = `over ${MAX_BACKUP_FILE_BYTES / (1024 * 1024)} MB`;

/** A record dropped while parsing, with why, so the user can be told what was left out. */
export interface DroppedRecord {
  kind: 'student' | 'goalTemplate' | 'session' | 'goal' | 'sessionGoal';
  id: string;
  reason: string;
}

/** What parseBackup returns: the backup, plus what it had to leave out. */
export interface ParsedBackup extends AppBackup {
  /** Settings blocks (abcLists, studentGroups) that were damaged and dropped. */
  droppedSettings: string[];
  /** Records dropped because a date on them was not a real date. */
  droppedRecords: DroppedRecord[];
  /** Whether any field outside the known shapes was present and stripped. */
  strippedUnknownFields: boolean;
}

export type RestoreMode = 'merge' | 'replace';

// Inner shapes are checked field by field and unknown fields are stripped (Zod's
// default), so a backup cannot smuggle in fields restore never expects. The checksum
// (below) is checked over this stripped payload, and settings are validated block by
// block in parseBackup so a damaged block is reported instead of silently dropped.
const BackupGoalSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.string(),
  dataCaptureType: z.string().optional(),
  smartGoal: z.string().optional(),
  sessionTargetValue: z.number().optional(),
  sessionTargetUses: z.number().optional(),
  targetDirection: z.enum(['increase', 'decrease']).optional(),
  isArchived: z.boolean().optional(),
  templateId: z.string().optional(),
  targetDate: z.string().optional(),
  baseline: z.number().optional(),
  baselineDate: z.string().optional(),
  masterySessions: z.number().optional(),
  taskSteps: z.array(z.string()).optional(),
  listItems: z.array(z.string()).optional(),
  sampleUnit: z.enum(['words', 'morphemes']).optional(),
  blankFills: z.array(z.string()).optional(),
  gasLevelDescriptions: z.array(z.string()).optional(),
  customType: CustomGoalTypeSchema.optional(),
});

const BackupStudentSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  goals: z.array(BackupGoalSchema),
  // Checked after parsing: a present-but-invalid createdAt drops the student, with a warning.
  createdAt: z.unknown().optional(),
  updatedAt: z.string().optional(),
  userId: z.string().optional(),
  isArchived: z.boolean().optional(),
  iep: z.object({
    iepDate: z.string().optional(),
    annualReviewDate: z.string().optional(),
    reevaluationDate: z.string().optional(),
    serviceMinutes: z.number().optional(),
    servicePer: z.enum(['week', 'month', 'year']).optional(),
    services: z.array(z.object({
      type: z.enum(['related', 'aac']),
      minutes: z.number(),
      per: z.enum(['week', 'month', 'year']),
    })).optional(),
  }).optional(),
});

const BackupTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.string(),
  dataCaptureType: z.string().optional(),
  smartGoalPrompt: z.string().optional(),
  generatedSmartGoal: z.string().optional(),
  sessionTargetValue: z.number().optional(),
  sessionTargetUses: z.number().optional(),
  // Checked after parsing: a present-but-invalid createdAt drops the template, with a warning.
  createdAt: z.unknown().optional(),
  isDefault: z.boolean().optional(),
  userId: z.string().optional(),
  isArchived: z.boolean().optional(),
  category: z.string().optional(),
  source: z.string().optional(),
  bankId: z.string().optional(),
  targetDirection: z.enum(['increase', 'decrease']).optional(),
  retired: z.boolean().optional(),
  baseline: z.number().optional(),
  taskSteps: z.array(z.string()).optional(),
  listItems: z.array(z.string()).optional(),
  sampleUnit: z.enum(['words', 'morphemes']).optional(),
  gasLevelDescriptions: z.array(z.string()).optional(),
  defaultKey: z.string().optional(),
  deleted: z.boolean().optional(),
  customType: CustomGoalTypeSchema.optional(),
});

const BackupSessionSchema = z.object({
  sessionId: z.string().min(1),
  studentId: z.string().min(1),
  studentName: z.string().optional(),
  // Checked after parsing: a date that is not a real date drops the session, with a warning.
  date: z.string(),
  time: z.string().optional(),
  endTime: z.string().optional(),
  activity: z.string().optional(),
  notes: z.string().optional(),
  goals: z.array(z.object({
    goalId: z.string(),
    goalName: z.string(),
    goalType: z.string(),
    data: z.record(z.string(), z.any()).optional(),
  })).optional(),
  originalGoalHeaders: z.array(BackupGoalSchema).optional(),
  missed: z.object({ reason: z.string(), note: z.string().optional() }).optional(),
  serviceMinutes: z.record(z.string(), z.number()).optional(),
  userId: z.string().optional(),
});

const BackupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.number().int(),
  exportedAt: z.string(),
  checksum: z.string().optional(),
  data: z.object({
    students: z.array(BackupStudentSchema),
    goalTemplates: z.array(BackupTemplateSchema),
    sessions: z.array(BackupSessionSchema),
  }),
  // Validated block by block in parseBackup (see extractSettings); unknown here so a
  // damaged settings object never rejects the whole backup.
  settings: z.unknown().optional(),
});

const StudentGroupSchema = z.array(z.object({ id: z.string(), name: z.string(), studentIds: z.array(z.string()) }));
const CustomGoalTypesListSchema = z.array(CustomGoalTypeSchema);

/** Pulls the settings blocks out of a parsed backup, naming the ones too damaged to keep. */
function extractSettings(raw: unknown): { settings?: BackupSettings; droppedSettings: string[] } {
  const droppedSettings: string[] = [];
  if (raw === undefined) return { settings: undefined, droppedSettings };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { settings: undefined, droppedSettings: ['settings'] };
  }
  const record = raw as Record<string, unknown>;
  const settings: BackupSettings = {};
  if (record.abcLists !== undefined) {
    const parsed = parseAbcLists(record.abcLists);
    if (parsed) settings.abcLists = parsed;
    else droppedSettings.push('abcLists');
  }
  if (record.commFunctions !== undefined) {
    const parsed = parseCommFunctions(record.commFunctions);
    if (parsed.ok) settings.commFunctions = parsed.data;
    else droppedSettings.push('commFunctions');
  }
  if (record.studentGroups !== undefined) {
    const parsed = StudentGroupSchema.safeParse(record.studentGroups);
    if (parsed.success) settings.studentGroups = parsed.data;
    else droppedSettings.push('studentGroups');
  }
  if (record.customGoalTypes !== undefined) {
    const parsed = CustomGoalTypesListSchema.safeParse(record.customGoalTypes);
    if (parsed.success) settings.customGoalTypes = parsed.data;
    else droppedSettings.push('customGoalTypes');
  }
  return { settings: Object.keys(settings).length ? settings : undefined, droppedSettings };
}

// Fields restore knows about, for reporting fields that were present and stripped.
const KNOWN_KEYS: Record<string, Set<string>> = {
  student: new Set(['id', 'name', 'goals', 'createdAt', 'updatedAt', 'userId', 'isArchived', 'iep']),
  goal: new Set(['id', 'name', 'type', 'dataCaptureType', 'smartGoal', 'sessionTargetValue', 'sessionTargetUses', 'targetDirection', 'isArchived', 'templateId', 'targetDate', 'baseline', 'baselineDate', 'masterySessions', 'taskSteps', 'listItems', 'sampleUnit', 'blankFills', 'gasLevelDescriptions', 'customType']),
  template: new Set(['id', 'name', 'type', 'dataCaptureType', 'smartGoalPrompt', 'generatedSmartGoal', 'sessionTargetValue', 'sessionTargetUses', 'createdAt', 'isDefault', 'userId', 'isArchived', 'category', 'source', 'bankId', 'targetDirection', 'retired', 'baseline', 'taskSteps', 'listItems', 'sampleUnit', 'defaultKey', 'deleted', 'gasLevelDescriptions', 'customType']),
  session: new Set(['sessionId', 'studentId', 'studentName', 'date', 'time', 'endTime', 'activity', 'notes', 'goals', 'originalGoalHeaders', 'missed', 'serviceMinutes', 'userId']),
  sessionGoal: new Set(['goalId', 'goalName', 'goalType', 'data']),
  iep: new Set(['iepDate', 'annualReviewDate', 'reevaluationDate', 'serviceMinutes', 'servicePer', 'services']),
  missed: new Set(['reason', 'note']),
};

function hasUnknownKeys(value: unknown, allowed: Set<string>): boolean {
  if (typeof value !== 'object' || value === null) return false;
  return Object.keys(value as Record<string, unknown>).some(k => !allowed.has(k));
}

/** Whether the raw backup data holds any field outside the known shapes (stripped on parse). */
function hasStrippedFields(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  const students = Array.isArray(d.students) ? d.students : [];
  const templates = Array.isArray(d.goalTemplates) ? d.goalTemplates : [];
  const sessions = Array.isArray(d.sessions) ? d.sessions : [];
  return [
    ...students.map(s => hasUnknownKeys(s, KNOWN_KEYS.student)
      || (typeof s === 'object' && s !== null && hasUnknownKeys((s as Record<string, unknown>).iep, KNOWN_KEYS.iep))
      || (Array.isArray((s as Record<string, unknown>).goals) && ((s as Record<string, unknown>).goals as unknown[]).some(g => hasUnknownKeys(g, KNOWN_KEYS.goal)))),
    ...templates.map(t => hasUnknownKeys(t, KNOWN_KEYS.template)),
    ...sessions.map(s => hasUnknownKeys(s, KNOWN_KEYS.session)
      || (typeof s === 'object' && s !== null && hasUnknownKeys((s as Record<string, unknown>).missed, KNOWN_KEYS.missed))
      || (Array.isArray((s as Record<string, unknown>).goals) && ((s as Record<string, unknown>).goals as unknown[]).some(g => hasUnknownKeys(g, KNOWN_KEYS.sessionGoal)))
      || (Array.isArray((s as Record<string, unknown>).originalGoalHeaders) && ((s as Record<string, unknown>).originalGoalHeaders as unknown[]).some(g => hasUnknownKeys(g, KNOWN_KEYS.goal)))),
  ].some(Boolean);
}

export function createBackup(data: BackupData, settings: BackupSettings = {}): AppBackup {
  const backup: AppBackup = { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
  const kept: BackupSettings = {
    ...(settings.abcLists ? { abcLists: settings.abcLists } : {}),
    ...(settings.commFunctions?.length ? { commFunctions: settings.commFunctions } : {}),
    ...(settings.studentGroups?.length ? { studentGroups: settings.studentGroups } : {}),
    ...(settings.customGoalTypes?.length ? { customGoalTypes: settings.customGoalTypes } : {}),
  };
  if (Object.keys(kept).length) backup.settings = kept;
  return backup;
}

/**
 * Builds a backup from what is stored on this device, without the data provider: the
 * first-run setup screen turns the passcode on before the provider has loaded, so its
 * backup step reads storage directly. Lists are hydrated first (localStorage blobs migrate
 * into IndexedDB, exactly as the normal load does), then read from the cache. `incomplete`
 * is true when a list could not be read: that list is left out of the backup, so an older
 * full backup should be kept rather than replaced by this one.
 */
export async function buildBackupFromStorage(uid: string | undefined): Promise<{ backup: AppBackup; incomplete: boolean }> {
  const keys = storageKeys(uid);
  await hydrateLists(keys);
  const students = readList<Student>(keys.students);
  const goalTemplates = readList<GoalTemplate>(keys.templates);
  const sessions = readList<SessionData>(keys.sessions);
  const backup = createBackup(
    { students: students ?? [], goalTemplates: goalTemplates ?? [], sessions: sessions ?? [] },
    { abcLists: loadCustomAbcLists() ?? undefined, commFunctions: loadCustomCommFunctions() ?? undefined, studentGroups: getStudentGroups(uid), customGoalTypes: getCustomGoalTypes(uid) },
  );
  return { backup, incomplete: students === undefined || goalTemplates === undefined || sessions === undefined };
}

export function backupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `AscendEd-backup_${stamp}.json`;
}

// ---- Backup integrity: SHA-256 checksum over the canonical payload ----

// JSON with object keys sorted, so the same payload always hashes the same way.
// Dates serialise as ISO strings (their toJSON), matching what JSON.stringify writes.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (typeof (value as { toJSON?: unknown }).toJSON === 'function') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).filter(k => record[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/** SHA-256 as hex, without Web Crypto (fallback for runtimes where subtle is unavailable). */
export function sha256HexSync(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLen = bytes.length * 8;
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen >>> 0);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  const w = new Array<number>(64);
  for (let block = 0; block < padded.length; block += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(block + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + s1 + ch + SHA256_K[i] + w[i]) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
}

/** SHA-256 of text as hex, via Web Crypto where available, else the synchronous fallback. */
export async function sha256Hex(text: string): Promise<string> {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (subtle) {
    const hash = await subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256HexSync(text);
}

/** The checksum of a backup payload: SHA-256 over the canonical data + settings. */
export async function computeBackupChecksum(data: BackupData, settings?: BackupSettings): Promise<string> {
  return sha256Hex(canonicalJson(settings === undefined ? { data } : { data, settings }));
}

// A backup file can be protected with a password: the backup's JSON is then encrypted, and the file holds only
// what is needed to decrypt it with the password.
export interface ProtectedBackupFile { app: typeof BACKUP_APP; protected: PasswordProtected }

/** The text of a backup file, encrypted with the password when one is given. */
export async function backupFileText(backup: AppBackup, password?: string): Promise<string> {
  // The checksum covers the plaintext payload, so it is checked after decryption.
  const withChecksum: AppBackup = { ...backup, checksum: await computeBackupChecksum(backup.data, backup.settings) };
  // Compact, not indented: indenting roughly doubled the file, and the restore limit is on the file's size.
  const json = JSON.stringify(withChecksum);
  if (new TextEncoder().encode(json).length > MAX_BACKUP_FILE_BYTES) {
    throw new Error(`This backup would be too large to restore (${TOO_LARGE}), so it was not saved. Use Settings → Delete Data to remove students who have left, then back up again.`);
  }
  if (!password) return json;
  const file: ProtectedBackupFile = { app: BACKUP_APP, protected: await encryptWithPassword(json, password) };
  const fileText = JSON.stringify(file);
  // Encryption expands the payload by about a third (base64), so the size
  // limit has to be checked on the final file text, not only the plaintext.
  if (new TextEncoder().encode(fileText).length > MAX_BACKUP_FILE_BYTES) {
    throw new Error(`This backup would be too large to restore (${TOO_LARGE}), so it was not saved. Use Settings → Delete Data to remove students who have left, then back up again.`);
  }
  return fileText;
}

/** Whether a backup file's text is password-protected (then decryptBackupText is needed before parseBackup). */
export function isProtectedBackup(text: string): boolean {
  try {
    const json = JSON.parse(text);
    return json?.app === BACKUP_APP && !!json.protected?.data;
  } catch {
    return false;
  }
}

/** The backup JSON inside a password-protected backup file. Throws a message for the user if the password is wrong. */
export async function decryptBackupText(text: string, password: string): Promise<string> {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_FILE_BYTES) {
    throw new Error(`This backup file is too large (${TOO_LARGE}). It cannot be restored.`);
  }
  let file: ProtectedBackupFile;
  try {
    file = JSON.parse(text) as ProtectedBackupFile;
  } catch {
    // The same message as every other damaged file, not a raw SyntaxError.
    throw new Error('Wrong password, or the file is damaged.');
  }
  try {
    return await decryptWithPassword(file.protected, password);
  } catch {
    throw new Error('Wrong password, or the file is damaged.');
  }
}

/** Whether a value is a real date (a parseable date string with a real calendar day, or a valid timestamp). */
function validDateValue(value: unknown): value is string | number {
  // A finite number can still be out of range (1e20): toISOString() on it throws and would abort the whole restore.
  if (typeof value === 'number') return Number.isFinite(value) && !Number.isNaN(new Date(value).getTime());
  if (typeof value !== 'string' || value.length === 0) return false;
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(value);
  if (isoDay && !isRealDate(Number(isoDay[1]), Number(isoDay[2]), Number(isoDay[3]))) return false;
  return !Number.isNaN(Date.parse(value));
}

/** A date value as an ISO string, or null when it is not a real date. */
function asIsoDate(value: unknown): string | null {
  if (!validDateValue(value)) return null;
  return new Date(value).toISOString();
}

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Parses and validates a backup file's text. Throws an Error with a message suitable for the user.
 * Files over MAX_BACKUP_FILE_BYTES are rejected before parsing. A present checksum must match the payload;
 * backups without one (legacy) still restore. Records with an invalid createdAt/date are
 * dropped and reported in droppedRecords, never stored as Invalid Date, and damaged
 * settings blocks are reported in droppedSettings. Unknown fields are stripped, and
 * strippedUnknownFields says whether any were present.
 */
export function parseBackup(text: string): ParsedBackup {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_FILE_BYTES) {
    throw new Error(`This backup file is too large (${TOO_LARGE}). It cannot be restored.`);
  }
  let rawJson: unknown;
  let json: unknown;
  try {
    // Parse once without reviver so checksum verification can check the payload exactly as written
    // (before legacy goal type keys are rewritten), then parse with reviveGoalTypes for normalization.
    rawJson = JSON.parse(text);
    json = JSON.parse(text, reviveGoalTypes);
  } catch {
    throw new Error('This file is not an AscendEd backup (it is not valid JSON).');
  }
  const result = BackupSchema.safeParse(json);
  if (!result.success) {
    throw new Error('This file is not an AscendEd backup, or it is damaged.');
  }
  if (result.data.version < 1) {
    throw new Error('This backup has an invalid version. It cannot be restored.');
  }
  if (result.data.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of AscendEd. Update the app and try again.');
  }
  if (typeof result.data.exportedAt !== 'string' || !ISO_DATETIME.test(result.data.exportedAt) || Number.isNaN(Date.parse(result.data.exportedAt))) {
    throw new Error('This backup has no valid export date. It cannot be restored.');
  }
  const raw = json as Record<string, unknown>;
  const rawAsWritten = rawJson as Record<string, unknown>;
  const { settings, droppedSettings } = extractSettings(raw.settings);
  const strippedUnknownFields = hasStrippedFields(raw.data);
  // The checksum is verified over the stripped payload, before any record is dropped,
  // so changing a value (or a date) fails the check instead of silently dropping a record.
  if (typeof result.data.checksum === 'string' && result.data.checksum.length > 0) {
    const expected = sha256HexSync(canonicalJson(settings === undefined ? { data: result.data.data } : { data: result.data.data, settings }));
    // The writer hashed the payload as it wrote it, which can hold fields this version strips or
    // legacy goal type keys before revival: the file as written matching its checksum is intact too.
    const asWritten = () => sha256HexSync(canonicalJson(rawAsWritten.settings === undefined ? { data: rawAsWritten.data } : { data: rawAsWritten.data, settings: rawAsWritten.settings }));
    if (expected !== result.data.checksum && asWritten() !== result.data.checksum) {
      throw new Error('This backup file is damaged (its contents do not match its checksum). Restore an earlier backup.');
    }
  }
  const droppedRecords: DroppedRecord[] = [];
  // A goal whose type (or data capture type) this app doesn't know is left out and reported: it can't be measured,
  // charted or entered, and a type from an earlier version is read as its current key.
  const knownGoals = <G extends { id: string; type: string; dataCaptureType?: string }>(goals: G[], owner: string): G[] => goals.flatMap(goal => {
    const type = knownGoalType(goal.type);
    const capture = goal.dataCaptureType === undefined ? undefined : knownGoalType(goal.dataCaptureType);
    if (type === undefined || (goal.dataCaptureType !== undefined && capture === undefined)) {
      droppedRecords.push({ kind: 'goal', id: `${goal.id}, on ${owner}`, reason: `goal type "${goal.dataCaptureType !== undefined && capture === undefined ? goal.dataCaptureType : goal.type}" is not known` });
      return [];
    }
    return [{ ...goal, type, ...(capture !== undefined ? { dataCaptureType: capture } : {}) }];
  });
  const students = result.data.data.students.filter(s => {
    if (s.createdAt === undefined || s.createdAt === null) return true;
    if (asIsoDate(s.createdAt) === null) {
      droppedRecords.push({ kind: 'student', id: s.id, reason: 'createdAt is not a valid date' });
      return false;
    }
    return true;
  }).map(s => ({
    ...s,
    goals: knownGoals(s.goals, `student ${s.id}`),
    // null (an invalid Date saved by an older app) is backfilled from the export date, like a template's.
    createdAt: s.createdAt === undefined ? s.createdAt : s.createdAt === null ? new Date(result.data.exportedAt).toISOString() : asIsoDate(s.createdAt),
  }));
  // A template's createdAt is only a sort hint. An invalid Date in an older app was saved to JSON as null: treat
  // it like a missing one (backfilled below) rather than dropping the template, as older versions restored it.
  const goalTemplates = result.data.data.goalTemplates.filter(t => {
    const type = knownGoalType(t.type);
    if (type === undefined || (t.dataCaptureType !== undefined && knownGoalType(t.dataCaptureType) === undefined)) {
      droppedRecords.push({ kind: 'goalTemplate', id: t.id, reason: `goal type "${type === undefined ? t.type : t.dataCaptureType}" is not known` });
      return false;
    }
    if (t.createdAt === undefined || t.createdAt === null) return true;
    if (asIsoDate(t.createdAt) === null) {
      droppedRecords.push({ kind: 'goalTemplate', id: t.id, reason: 'createdAt is not a valid date' });
      return false;
    }
    return true;
  }).map(t => ({
    ...t,
    type: knownGoalType(t.type)!,
    ...(t.dataCaptureType !== undefined ? { dataCaptureType: knownGoalType(t.dataCaptureType)! } : {}),
    // Template dates are stored as strings in JSON; the app works with Date objects.
    // A missing createdAt is backfilled from the export date, so it is never Invalid Date.
    createdAt: t.createdAt === undefined || t.createdAt === null ? new Date(result.data.exportedAt) : new Date(asIsoDate(t.createdAt)!),
  }));
  const sessions = result.data.data.sessions.filter(s => {
    if (!validDateValue(s.date)) {
      droppedRecords.push({ kind: 'session', id: s.sessionId, reason: 'date is not a valid date' });
      return false;
    }
    return true;
  }).map(s => {
    // A recorded goal of an unknown type is left out of its session, and so is a goal header of one.
    const goals = (s.goals ?? []).flatMap(g => {
      const type = knownGoalType(g.goalType);
      if (type === undefined) {
        droppedRecords.push({ kind: 'sessionGoal', id: `${g.goalId}, in session ${s.sessionId}`, reason: `goal type "${g.goalType}" is not known` });
        return [];
      }
      return [{ ...g, goalType: type }];
    });
    const headers = s.originalGoalHeaders === undefined ? undefined : knownGoals(s.originalGoalHeaders, `session ${s.sessionId}`);
    return { ...s, ...(s.goals !== undefined ? { goals } : {}), ...(headers !== undefined ? { originalGoalHeaders: headers } : {}) };
  });
  return {
    app: result.data.app,
    version: result.data.version,
    exportedAt: result.data.exportedAt,
    checksum: result.data.checksum,
    data: {
      students: students as unknown as Student[],
      goalTemplates: goalTemplates as unknown as GoalTemplate[],
      sessions: sessions as unknown as SessionData[],
    },
    ...(settings !== undefined ? { settings } : {}),
    droppedSettings,
    droppedRecords,
    strippedUnknownFields,
  };
}

export interface RestoreSummary {
  students: number;
  goalTemplates: number;
  sessions: number;
  /** Goals added to students already on the device. */
  goals: number;
  /** What parseBackup had to leave out (damaged settings and records), in words, for the message shown after a restore. */
  leftOut?: string[];
}

/** What a backup's parsing left out, in words (empty when nothing was). */
export function describeLeftOut(backup: Partial<Pick<ParsedBackup, 'droppedSettings' | 'droppedRecords'>>): string[] {
  const settings = (backup.droppedSettings ?? []).map(name => `the ${name === 'abcLists' ? 'ABC lists' : name === 'commFunctions' ? 'communication functions' : name === 'studentGroups' ? 'student groups' : name === 'customGoalTypes' ? 'custom goal types' : name} settings`);
  const records = (backup.droppedRecords ?? []).map(r =>
    `${r.kind === 'goalTemplate' ? 'a goal template' : r.kind === 'sessionGoal' ? 'a goal in a session' : `a ${r.kind}`} (${r.id}: ${r.reason})`);
  return [...settings, ...records];
}

/**
 * Combines a backup with the data already on the device. Records already present (same id)
 * keep the device's version, so restoring the same backup twice adds nothing. Built-in default
 * templates are matched by name, because every device creates them with its own ids.
 */
export function mergeBackupData(current: BackupData, incoming: BackupData): { merged: BackupData; added: RestoreSummary } {
  const studentIds = new Set(current.students.map(s => s.id));
  const newStudents: Student[] = [];
  for (const s of incoming.students) {
    if (studentIds.has(s.id)) continue;
    studentIds.add(s.id);
    newStudents.push(s);
  }

  // A student on both keeps the device's version, plus any goals only the backup has (so sessions
  // recorded for those goals still have them).
  const incomingById = new Map(incoming.students.map(s => [s.id, s]));
  let addedGoals = 0;
  const students = current.students.map(student => {
    const goalIds = new Set((student.goals || []).map(g => g.id));
    const extra = (incomingById.get(student.id)?.goals || []).filter(g => {
      if (goalIds.has(g.id)) return false;
      goalIds.add(g.id);
      return true;
    });
    if (extra.length === 0) return student;
    addedGoals += extra.length;
    return { ...student, goals: [...(student.goals || []), ...extra] };
  });

  const templateIds = new Set(current.goalTemplates.map(t => t.id));
  // Built-in templates are matched by the name they were added under, so a renamed one isn't added twice.
  const defaultNames = new Set(current.goalTemplates.filter(t => t.isDefault).map(defaultTemplateKey));
  const newTemplates: GoalTemplate[] = [];
  for (const t of incoming.goalTemplates) {
    if (templateIds.has(t.id) || (t.isDefault && defaultNames.has(defaultTemplateKey(t)))) continue;
    templateIds.add(t.id);
    if (t.isDefault) defaultNames.add(defaultTemplateKey(t));
    newTemplates.push(t);
  }

  const sessionIds = new Set(current.sessions.map(s => s.sessionId));
  const newSessions: SessionData[] = [];
  for (const s of incoming.sessions) {
    if (sessionIds.has(s.sessionId)) continue;
    sessionIds.add(s.sessionId);
    newSessions.push(s);
  }

  return {
    merged: {
      students: [...students, ...newStudents],
      goalTemplates: [...current.goalTemplates, ...newTemplates],
      sessions: [...current.sessions, ...newSessions],
    },
    added: { students: newStudents.length, goalTemplates: newTemplates.length, sessions: newSessions.length, goals: addedGoals },
  };
}
