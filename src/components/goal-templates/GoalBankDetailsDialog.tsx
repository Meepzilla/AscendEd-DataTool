'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { GoalTemplate } from '@/lib/types';

interface GoalBankDetails {
  purpose: string;
  activityIdeas: string[];
  tags: Record<string, string>;
}

// Purpose, activity ideas and tags for goal bank templates. Kept out of the app bundle and the stored
// templates (it's about 1 MB) and loaded the first time a goal's details are opened.
let detailsPromise: Promise<Record<string, GoalBankDetails>> | null = null;
function loadGoalBankDetails() {
  if (!detailsPromise) {
    detailsPromise = fetch('/goal-bank/details.json').then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
    detailsPromise.catch(() => { detailsPromise = null; });
  }
  return detailsPromise;
}

export default function GoalBankDetailsDialog({ template, onClose }: { template: GoalTemplate | null; onClose: () => void }) {
  const [details, setDetails] = useState<GoalBankDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetails(null);
    setError(null);
    if (!template?.bankId) return;
    loadGoalBankDetails()
      .then(all => setDetails(all[template.bankId!] ?? null))
      .catch(() => setError("Details couldn't be loaded. Connect to the internet once so the app can store them."));
  }, [template]);

  return (
    <Dialog open={!!template} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template?.name}</DialogTitle>
          <DialogDescription>
            {[template?.category, template?.source].filter(Boolean).join(' · ')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {template?.generatedSmartGoal && (
            <section>
              <h3 className="font-semibold mb-1">Goal</h3>
              <p>{template.generatedSmartGoal}</p>
            </section>
          )}
          {error && <p className="text-destructive">{error}</p>}
          {!details && !error && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>}
          {details && (
            <>
              {details.purpose && (
                <section>
                  <h3 className="font-semibold mb-1">Purpose</h3>
                  <p className="text-muted-foreground">{details.purpose}</p>
                </section>
              )}
              {details.activityIdeas.length > 0 && (
                <section>
                  <h3 className="font-semibold mb-1">Activity Ideas</h3>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    {details.activityIdeas.map((idea, i) => <li key={i}>{idea}</li>)}
                  </ul>
                </section>
              )}
              {Object.keys(details.tags).length > 0 && (
                <section>
                  <h3 className="font-semibold mb-1">Tags</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(details.tags).flatMap(([key, value]) =>
                      value.split(';').map(v => v.trim()).filter(Boolean).map(v => (
                        <Badge key={`${key}-${v}`} variant="outline" title={key}>{key}: {v}</Badge>
                      ))
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
