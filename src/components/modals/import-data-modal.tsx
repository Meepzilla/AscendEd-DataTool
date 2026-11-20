
'use client';

import React, { useState } from 'react';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, FileCheck2, AlertTriangle } from 'lucide-react';
import Papa from 'papaparse';
import { parseSessionCsvRows, type ImportedSession } from '@/lib/session-import';
import { checkImportFileSize } from '@/lib/helpers';
import { sanitizeErrorMessage, toSafeErrorMessage } from '@/lib/error-message';
import { unescapeCsvFormula } from '@/lib/session-csv';
import { useDropzone } from 'react-dropzone';

/** A session read from the file, with the Session ID it had (kept, so a later backup merge matches it). */
export type { ImportedSession };

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
      try {
        checkImportFileSize(selectedFile.size);
      } catch (error) {
        toast({ title: 'File too large', description: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)), variant: 'destructive' });
        return;
      }
      setIsParsing(true);
      setParsedSessions([]);
      setFile(selectedFile);
      Papa.parse<any>(selectedFile, {
        header: true,
        skipEmptyLines: true,
        // The export writes formula-like cells with a leading apostrophe (session-csv.ts); take it off again.
        transform: (value: string) => unescapeCsvFormula(value),
        complete: (results) => {
          try {
            const finalSessions = parseSessionCsvRows(results.data);
            setParsedSessions(finalSessions);
            toast({
              title: "File Parsed Successfully",
              description: `Found ${finalSessions.length} session records to import.`,
            });
          } catch (error: any) {
            // Log the message only, sanitised: the error object can carry row content.
            console.error('Error parsing CSV data:', toSafeErrorMessage(error));
            setFile(null);
            setParsedSessions([]);
            toast({
              title: "Parsing Error",
              description: error instanceof Error && error.message ? sanitizeErrorMessage(error.message) : "Could not parse session data from CSV file. Please check the file format.",
              variant: "destructive",
            });
          } finally {
            setIsParsing(false);
          }
        },
        error: (error: Error) => {
          console.error('PapaParse error:', toSafeErrorMessage(error));
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
        description: error instanceof Error && error.message ? sanitizeErrorMessage(error.message) : "An unexpected error occurred during import.",
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
