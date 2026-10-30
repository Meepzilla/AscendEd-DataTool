'use client';

import React, { useEffect, useState } from 'react';
import { Copy, Download, FileText, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { buildNarrative, type NarrativeInput, type NarrativeStyle } from '@/lib/report-narrative';
import { saveTextFile } from '@/lib/save-file';

// The "Write Narrative" button on Reports: a written summary of the data in view (student, goals and
// date range), which can be edited, copied or saved as a text file.
export default function NarrativeDialog(props: NarrativeInput & { disabled?: boolean }) {
  const { disabled, ...input } = props;
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [style, setStyle] = useState<NarrativeStyle>('detailed');
  const [nextSteps, setNextSteps] = useState(false);

  const generate = () => setText(buildNarrative({ ...input, options: { style, nextSteps } }));
  useEffect(() => {
    if (open) generate();
    // Regenerate when the dialog opens or the format changes; edits are kept otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, style, nextSteps]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Narrative copied', description: 'Paste it into a progress report or email.' });
    } catch {
      toast({ title: "Couldn't copy", description: 'Select the text and copy it instead.', variant: 'destructive' });
    }
  };

  const save = async () => {
    const safeName = input.student.name.replace(/[^a-z0-9]+/gi, '_');
    const date = new Date().toISOString().split('T')[0];
    await saveTextFile(`narrative_${safeName}_${date}.txt`, text, 'text/plain').catch(() => {
      toast({ title: "Couldn't save the file", variant: 'destructive' });
    });
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={disabled}>
        <FileText className="mr-2 h-4 w-4" /> Write Narrative
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Progress Narrative</DialogTitle>
            <DialogDescription>
              Written from the data shown on this page (student, goals and date range). Review and edit it before using it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex gap-1" role="radiogroup" aria-label="Narrative length">
              {(['detailed', 'brief'] as const).map(option => (
                <Button key={option} type="button" size="sm" role="radio" aria-checked={style === option}
                  variant={style === option ? 'default' : 'outline'} onClick={() => setStyle(option)}
                  title={option === 'detailed' ? 'A paragraph per goal' : 'One line per goal'}>
                  {option === 'detailed' ? 'Detailed' : 'Brief'}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Switch id="narrative-next-steps" checked={nextSteps} onCheckedChange={setNextSteps} />
              <Label htmlFor="narrative-next-steps" className="text-sm">Suggested next steps</Label>
            </div>
            <p className="text-xs text-muted-foreground">Changing these rewrites the text (edits are lost).</p>
          </div>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[50vh] text-sm leading-relaxed" aria-label="Narrative text" />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={generate} title="Start over from the data (discards edits)">
              <RotateCcw className="mr-2 h-4 w-4" /> Regenerate
            </Button>
            <Button variant="outline" onClick={save}><Download className="mr-2 h-4 w-4" /> Save as File</Button>
            <Button onClick={copy}><Copy className="mr-2 h-4 w-4" /> Copy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
