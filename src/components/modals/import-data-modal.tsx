
'use client';

import React, { useState, useCallback } from 'react';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, FileCheck2, AlertTriangle } from 'lucide-react';
import Papa from 'papaparse';
import type { SessionData } from '@/lib/types';
import { useDropzone } from 'react-dropzone';

interface ImportDataModalProps {
  onClose: () => void;
  onImport: (sessions: Omit<SessionData, 'sessionId'>[]) => Promise<{ newCount: number; duplicateCount: number }>;
}

export default function ImportDataModal({ onClose, onImport }: ImportDataModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parsedSessions, setParsedSessions] = useState<Omit<SessionData, 'sessionId'>[]>([]);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleFileChange(acceptedFiles[0]);
    }
  }, []);

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
            const sessions: Omit<SessionData, 'sessionId'>[] = results.data.map(row => {
              if (!row.studentId || !row.date || !row.studentName) {
                throw new Error('CSV row is missing required fields (studentId, date, studentName).');
              }
              return {
                studentId: row.studentId,
                studentName: row.studentName,
                date: row.date,
                time: row.time,
                endTime: row.endTime,
                activity: row.activity,
                notes: row.notes,
                goals: JSON.parse(row.goals || '[]'),
                originalGoalHeaders: [], // This will be ignored on import, but needed for type
              };
            });
            setParsedSessions(sessions);
            toast({
              title: "File Parsed Successfully",
              description: `Found ${sessions.length} session records to import.`,
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
      const { newCount, duplicateCount } = await onImport(parsedSessions);
      toast({
        title: "Import Complete",
        description: `Successfully imported ${newCount} new sessions. ${duplicateCount} duplicate sessions were skipped.`,
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
