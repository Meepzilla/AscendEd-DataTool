'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollText } from 'lucide-react';
import { APP_NAME } from '@/lib/appConstants';
import { changelogEntries } from '@/data/changelog-entries';

export default function ChangelogPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ScrollText className="h-10 w-10 text-primary" />
            <div>
              <CardTitle role="heading" aria-level={1} className="text-3xl font-bold">What&apos;s New</CardTitle>
              <CardDescription>
                Stay updated with the latest features, improvements, and fixes in {APP_NAME}.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Updates</CardTitle>
        </CardHeader>
        <CardContent>
          {changelogEntries.length === 0 ? (
            <p className="text-muted-foreground">No changelog entries yet. Check back soon!</p>
          ) : (
            <Accordion type="multiple" className="w-full" defaultValue={changelogEntries[0] ? [changelogEntries[0].date + changelogEntries[0].title] : []}>
              {changelogEntries.map((entry, index) => (
                <AccordionItem value={entry.date + entry.title} key={index}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-3">
                      <entry.icon className="h-5 w-5 text-primary" />
                      <span className="font-semibold text-lg">{entry.title}</span>
                      <span className="text-sm text-muted-foreground ml-auto">{entry.date}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pl-8">
                    <p className="text-muted-foreground">{entry.description}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
