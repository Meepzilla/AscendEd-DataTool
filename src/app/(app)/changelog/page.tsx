
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollText, GitMerge, Zap, Bug, PlusCircle, Pencil, ArrowUpDown, BarChartHorizontalBig, KeyboardIcon, Smartphone, Trash2, LayoutGrid, Minimize2, UserX, ArrowRightLeft, Lightbulb, Download } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

interface ChangelogEntry {
  version?: string; // Optional version number
  date: string;
  title: string;
  description: string;
  type: 'feature' | 'fix' | 'improvement' | 'hotkey';
  icon: React.ElementType;
}

const changelogEntries: ChangelogEntry[] = [
  {
    date: '2025-06-17',
    title: 'Data Entry Page Layout Enhancement',
    description: 'Student cards on the Data Entry page now dynamically resize based on focus. The focused student\'s card widens to provide more space, while non-focused cards become narrower but remain visible.',
    type: 'improvement',
    icon: ArrowRightLeft,
  },
  {
    date: '2025-06-17',
    title: 'Assign Goal Modal UI Update',
    description: 'The "Create & Assign Custom Goal" button in the Assign Goal modal has been repositioned to appear directly after the custom goal input fields, aligned to the right for a more intuitive workflow.',
    type: 'improvement',
    icon: Pencil,
  },
  {
    date: '2025-06-17',
    title: 'AI Technical Summary Prompt Enhancement',
    description: 'Updated the prompt for AI-generated technical summaries on the Analysis Report page to guide the AI towards more insightful and concise observations based on student data.',
    type: 'improvement',
    icon: Lightbulb,
  },
  {
    date: '2025-06-17',
    title: 'Analysis Report Bug Fix',
    description: 'Resolved a "params enumerated" warning on the Analysis Report page, improving stability when handling URL parameters.',
    type: 'fix',
    icon: Bug,
  },
  {
    date: '2025-06-17',
    title: 'Expanded Default Articulation Goals',
    description: 'Significantly increased the number of pre-made default articulation goal templates, providing a richer set of starting points for educators.',
    type: 'feature',
    icon: ListPlus,
  },
  {
    date: '2025-06-17',
    title: 'Analysis Report CSV Export Improvement',
    description: 'The CSV data export feature on the Analysis Report page now includes a "Goal" column, indicating whether the data pertains to a specific goal or all goals.',
    type: 'improvement',
    icon: Download,
  },
  {
    date: '2025-06-17',
    title: 'Enhanced Mobile & Tablet Responsiveness',
    description: 'Improved application layout and usability on smaller screens, including adjustments to dashboards, forms, tables, and modals for better mobile device support.',
    type: 'improvement',
    icon: Smartphone,
  },
  {
    date: '2025-06-17',
    title: 'Data Entry Hotkey Update: Student Slot Focus',
    description: 'Changed the hotkey to focus on specific student slots (1-4) on the Data Entry page from "Alt + #" to just "#".',
    type: 'hotkey',
    icon: KeyboardIcon,
  },
  {
    date: '2025-06-17',
    title: 'Data Entry Student Icon Opens Edit Modal',
    description: 'The student icon on each card in the Data Entry page now opens the "Edit Student" modal for quick goal management.',
    type: 'improvement',
    icon: Pencil,
  },
    {
    date: '2025-06-17',
    title: 'Scroll to Focused Goal in Data Entry',
    description: 'The Data Entry page now automatically scrolls the currently focused goal into view for easier navigation.',
    type: 'improvement',
    icon: ArrowUpDown,
  },
  {
    date: '2025-06-17',
    title: 'Student Deletion Feature',
    description: 'Added the ability to delete students and their associated session data, with a confirmation prompt. Accessible from the Student Profile page and sidebar.',
    type: 'feature',
    icon: UserX,
  },
  {
    date: '2025-06-17',
    title: 'Top Ribbon Navigation',
    description: 'Redesigned main application navigation to a top ribbon menu for desktop users, streamlining the interface. Mobile navigation remains in a slide-out drawer.',
    type: 'improvement',
    icon: LayoutGrid,
  },
  {
    date: '2025-06-17',
    title: 'Multi-Goal Assignment Fix',
    description: 'Fixed an issue where assigning multiple goal templates to a student simultaneously would sometimes result in only one goal being added.',
    type: 'fix',
    icon: Bug,
  },
  {
    date: '2025-06-17',
    title: 'Compact Goal Inputs on Data Entry Page',
    description: 'Redesigned goal input cards on the Data Entry page to be more compact, allowing more goals to be visible per student.',
    type: 'improvement',
    icon: Minimize2,
  },
  {
    date: '2025-06-17', // Placeholder date
    title: 'Changelog Page Added',
    description: `Introduced this Changelog page to track application updates and new features. Accessible via sidebar and Alt+6.`,
    type: 'feature',
    icon: PlusCircle,
  },
  {
    date: '2025-06-17',
    title: 'Fluency Goal Logic Correction & Percentage-Based Targets',
    description: 'Corrected "Total Syllables" and "Stuttered Syllables" interaction on the Data Entry page. Goal session target values now represent a percentage (0-100) for quantifiable goals, with UI and progress calculations updated accordingly.',
    type: 'fix',
    icon: Bug,
  },
  {
    date: '2025-06-17',
    title: 'Edit Assigned Student Goals',
    description: 'Added the ability to edit goals directly assigned to students via a new modal accessible from the Student Profile page.',
    type: 'feature',
    icon: Pencil,
  },
  {
    date: '2025-06-17',
    title: 'Reorder Goals on Data Entry Page',
    description: 'Users can now reorder the display of goals for each student directly on the Data Entry page using up/down arrow buttons.',
    type: 'feature',
    icon: ArrowUpDown,
  },
  {
    date: '2025-06-17',
    title: 'Ctrl+Enter Confirmation Hotkey',
    description: 'Implemented Ctrl+Enter as a confirmation hotkey for saving sessions, submitting forms in modals, and confirming actions in dialogs.',
    type: 'hotkey',
    icon: KeyboardIcon,
  },
  {
    date: '2025-06-17',
    title: 'Enhanced Analysis Reports',
    description: 'Added more metrics to the Analysis Report page, including "Response Counts" and "Total Opportunities" line charts.',
    type: 'improvement',
    icon: BarChartHorizontalBig,
  },
  {
    date: '2025-06-17',
    title: 'Student Cycling Hotkey (A/Alt+A) in Data Entry',
    description: 'Added "A" and "Alt+A" hotkeys to cycle to the next/previous student slot on the Data Entry page.',
    type: 'hotkey',
    icon: KeyboardIcon,
  },
  {
    date: '2025-06-17',
    title: 'Help Page Added',
    description: 'Introduced a comprehensive Help page with application guidance and a list of hotkeys. Accessible via header icon and Alt+H.',
    type: 'feature',
    icon: PlusCircle,
  },
];

// Note: getIconForType is not strictly necessary if each entry defines its icon,
// but it can be a fallback or utility if needed elsewhere.
const getIconForType = (type: ChangelogEntry['type']): React.ElementType => {
  switch (type) {
    case 'feature': return Zap;
    case 'fix': return Bug;
    case 'improvement': return GitMerge;
    case 'hotkey': return KeyboardIcon;
    default: return GitMerge;
  }
};

export default function ChangelogPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ScrollText className="h-10 w-10 text-primary" />
            <div>
              <CardTitle className="text-3xl font-bold">Application Changelog</CardTitle>
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

