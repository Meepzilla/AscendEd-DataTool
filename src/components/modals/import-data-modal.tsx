
'use client';

import React, { useState } from 'react';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, FileCheck2, AlertTriangle } from 'lucide-react';
import Papa from 'papaparse';
import type { GoalType, SessionData, SessionGoalData } from '@/lib/types';
import { currentGoalType } from '@/lib/legacy-goal-types';
import { GOAL_TYPE_FIELDS } from '@/lib/goal-constants';

/** A session read from the file, with the Session ID it had (kept, so a later backup merge matches it). */
export type ImportedSession = Omit<SessionData, 'sessionId'> & { sourceSessionId?: string };

/**
 * A CSV cell as the value it was exported from: lists and objects were written as JSON, numbers and true/false as
 * text. Fields that are text in the goal type's starting values (a target sound, notes) stay text, so "5" or
 * "[1,2]" typed into them comes back unchanged.
 */
function cellValue(raw: string, goalType: string, key: string): unknown {
  const defaults = GOAL_TYPE_FIELDS[goalType as GoalType] as Record<string, unknown> | undefined;
  if (defaults && typeof defaults[key] === 'string') return raw;
  const text = raw.trim();
  if (text.startsWith('[') || text.startsWith('{')) {
    try { return JSON.parse(text); } catch { return raw; }
  }
  if (text === 'true' || text === 'false') return text === 'true';
  if (text === 'null') return null;
  return text !== '' && !Number.isNaN(Number(text)) ? Number(text) : raw;
}
import { useDropzone } from 'react-dropzone';

interface ImportDataModalProps {
  onClose: () => void;
  onImport: (sessions: ImportedSession[]) => Promise<{ newCount: number; duplicateCount: number; unmatchedCount: number; addedGoalCount: number }>;
}

export default function ImportDataModal({ onClose, onImport }: ImportDataModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parsedSessions, setParsedSessions] = useState<ImportedSession[]>([]);
  const { toast } = useToast();

  // A plain function (not useCallback), so it always uses the current handleFileChange.
  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleFileChange(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  });

  const handleFileChange = (selectedFile: File) => {
    if (selectedFile) {
      setIsParsing(true);
      setParsedSessions([]);
      setFile(selectedFile);
      Papa.parse<any>(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const rows = results.data;
            if (rows.length === 0) {
              throw new Error("CSV file is empty or contains no data rows.");
            }

            // Group rows by Session ID
            const sessionsMap = new Map<string, ImportedSession>();

            for (const row of rows) {
              const sessionId = row['Session ID'];
              if (!sessionId) {
                console.warn("Skipping row with missing Session ID:", row);
                continue;
              }

              let sessionEntry = sessionsMap.get(sessionId);

              // If it's the first time seeing this session ID, create the base session object.
              if (!sessionEntry) {
                 if (!row['Student ID'] || !row['Date'] || !row['Student Name']) {
                    throw new Error(`Row for session ${sessionId} is missing required fields (Student ID, Date, Student Name).`);
                }
                sessionEntry = {
                  studentId: row['Student ID'],
                  studentName: row['Student Name'],
                  date: row['Date'],
                  time: row['Start Time'],
                  endTime: row['End Time'] && row['End Time'] !== 'N/A' ? row['End Time'] : undefined,
                  activity: row['Activity'],
                  notes: row['Session Notes'],
                  goals: [],
                  originalGoalHeaders: [], // Not in the file; Edit Session uses the student's goals instead.
                  sourceSessionId: sessionId,
                };
                sessionsMap.set(sessionId, sessionEntry);
              }

              // If the row contains goal information, process it.
              if (row['Goal ID'] && row['Goal Name']) {
                const goalData: SessionGoalData['data'] = {};
                for (const key in row) {
                  if (key.startsWith('Goal Data: ')) {
                    const dataKeyRaw = key.replace('Goal Data: ', '');
                    // Export spaced the key out before each capital ("Partial Physical", "total Syllables"), keeping
                    // the first letter's case, so joining the words back gives the original key.
                    const camelCaseKey = dataKeyRaw.replace(/\s+(.)/g, (_match: string, letter: string) => letter.toUpperCase()).trim();
                    
                    let value = row[key];
                    // Columns from other goal types are empty for this goal.
                    if (value === undefined || value === null || value === '') continue;
                    value = cellValue(String(value), String(currentGoalType(row['Goal Type'])), camelCaseKey);
                    goalData[camelCaseKey] = value;
                  }
                }

                const sessionGoal: SessionGoalData = {
                  goalId: row['Goal ID'],
                  goalName: row['Goal Name'],
                  goalType: currentGoalType(row['Goal Type']) as GoalType,
                  data: goalData,
                };

                // Avoid duplicating goals if they appear in multiple rows for the same session (unlikely with new format, but safe)
                if (!sessionEntry.goals.find(g => g.goalId === sessionGoal.goalId)) {
                    sessionEntry.goals.push(sessionGoal);
                }
              }
            }

            const finalSessions = Array.from(sessionsMap.values());
            setParsedSessions(finalSessions);
            toast({
              title: "File Parsed Successfully",
              description: `Found ${finalSessions.length} session records to import.`,
            });
          } catch (error: any) {
            console.error("Error parsing CSV data:", error);
            setFile(null);
            setParsedSessions([]);
            toast({
              title: "Parsing Error",
              description: error.message || "Could not parse session data from CSV file. Please check the file format.",
              variant: "destructive",
            });
          } finally {
            setIsParsing(false);
          }
        },
        error: (error: Error) => {
          console.error("PapaParse error:", error);
          setFile(null);
          setParsedSessions([]);
          toast({
            title: "File Read Error",
            description: "Could not read the selected file.",
            variant: "destructive",
          });
          setIsParsing(false);
        },
      });
    }
  };

  const handleImport = async () => {
    if (parsedSessions.length === 0) {
      toast({ title: "No Data", description: "No sessions to import.", variant: "default" });
      return;
    }
    setIsImporting(true);
    try {
      const { newCount, duplicateCount, unmatchedCount, addedGoalCount } = await onImport(parsedSessions);
      toast({
        title: "Import Complete",
        description: `Imported ${newCount} new sessions. ${duplicateCount} already on this device were skipped.`
          + (unmatchedCount ? ` ${unmatchedCount} for students not on this device were skipped (add the student with the same name, then import again).` : '')
          + (addedGoalCount ? ` ${addedGoalCount} goal(s) in the file weren't on the student here, so they were added to the student (archive any you don't need).` : ''),
        variant: newCount === 0 && unmatchedCount > 0 ? 'destructive' : 'default',
      });
      onClose();
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "An unexpected error occurred during import.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <GenericModal
      isOpen={true}
      onClose={onClose}
      title="Import Session Data"
      description="Upload a CSV file with session data. This should match the format of an exported file."
    >
      <div className="space-y-4">
        <div
          {...getRootProps()}
          className={`p-10 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
          {isDragActive ? (
            <p>Drop the file here ...</p>
          ) : (
            <p>Drag & drop a CSV file here, or click to select a file</p>
          )}
        </div>

        {isParsing && (
            <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Parsing file...
            </div>
        )}

        {file && !isParsing && (
          <div className="flex items-center justify-between p-2 border rounded-md">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium">{file.name}</span>
            </div>
            <p className="text-sm text-muted-foreground">{parsedSessions.length} records found</p>
          </div>
        )}
        
        {parsedSessions.length > 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-yellow-800 dark:text-yellow-300 text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Warning:</strong> Importing will add new sessions to your database. It will skip sessions that appear to be duplicates (same student, date, and time). This action cannot be undone.
                </div>
            </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={isParsing || isImporting || parsedSessions.length === 0}
          >
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isImporting ? 'Importing...' : `Import ${parsedSessions.length} Sessions`}
          </Button>
        </div>
      </div>
    </GenericModal>
  );
}
