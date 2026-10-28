
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle, Keyboard, BookOpen, Lightbulb } from 'lucide-react';
import { APP_NAME } from '@/lib/appConstants';
import { AI_ENABLED } from '@/lib/features';

interface Hotkey {
  key: string;
  description: string;
  category: string;
}

const hotkeys: Hotkey[] = [
  // Global Navigation
  { key: 'Alt + D', description: 'Navigate to Dashboard', category: 'Global Navigation' },
  { key: 'Alt + 1', description: 'Navigate to Data Entry', category: 'Global Navigation' },
  { key: 'Alt + 2', description: 'Navigate to Sessions Page', category: 'Global Navigation' },
  { key: 'Alt + 3', description: 'Navigate to Analysis & Reports', category: 'Global Navigation' },
  { key: 'Alt + 4', description: 'Navigate to Students Page', category: 'Global Navigation' },
  { key: 'Alt + 5', description: 'Navigate to Goal Templates', category: 'Global Navigation' },
  // Global Actions
  { key: 'Alt + H', description: 'Open this Help Page', category: 'Global Actions' },
  { key: 'Alt + J', description: 'Open Error Log Modal', category: 'Global Actions' },
  { key: 'Alt + M', description: 'Open Add Student Modal', category: 'Global Actions' },
  { key: 'Alt + K', description: 'Toggle Sidebar', category: 'Global Actions'},
  { key: 'Ctrl + Enter (Cmd + Enter on Mac/iPad)', description: 'Confirm action / Save (contextual)', category: 'Global Actions'},
  // Data Entry Specific
  { key: 'Alt + L', description: 'Toggle Student Access Lock', category: 'Data Entry' },
  { key: '1, 2, 3, or 4', description: 'Focus on Student Slot 1-4', category: 'Data Entry' },
  { key: 'A', description: 'Cycle to Next Student Slot', category: 'Data Entry' },
  { key: 'Alt + A', description: 'Cycle to Previous Student Slot', category: 'Data Entry' },
  { key: 'S', description: 'Cycle to Next Goal (for focused student)', category: 'Data Entry' },
  { key: 'Alt + S', description: 'Cycle to Previous Goal (for focused student)', category: 'Data Entry' },
  { key: 'Alt + W', description: 'Add a new student slot', category: 'Data Entry'},
  { key: 'Alt + Q', description: 'Remove focused student slot', category: 'Data Entry'},
  { key: 'Alt + U', description: 'Open Select Student modal', category: 'Data Entry' },
  { key: 'Alt + T', description: 'Open Select Goal modal', category: 'Data Entry' },
  { key: 'C', description: 'Increment Correct (Discrete Trials: mark next trial correct; Behavior Frequency: add an occurrence)', category: 'Data Entry' },
  { key: 'N', description: 'Increment Incorrect (Discrete Trials: mark next trial incorrect)', category: 'Data Entry' },
  { key: 'B', description: 'Increment Approximate (Discrete Trials: mark next trial approximate) / Blocks (Fluency)', category: 'Data Entry' },
  { key: 'D', description: 'Increment Visual Prompt count', category: 'Data Entry' },
  { key: 'V', description: 'Increment Verbal Prompt count', category: 'Data Entry' },
  { key: 'G', description: 'Increment Gestural Prompt count', category: 'Data Entry' },
  { key: 'P', description: 'Increment Partial Physical Prompt count', category: 'Data Entry' },
  { key: 'F', description: 'Increment Imitation Prompt count', category: 'Data Entry' },
  { key: 'I', description: 'Increment Independent count (also increments main Correct count)', category: 'Data Entry' },
  { key: 'Alt + E', description: 'Edit focused student\'s info/goals (from Data Entry page)', category: 'Data Entry' },
  { key: 'R', description: 'Increment Repetitions (Fluency)', category: 'Data Entry' },
  { key: 'H', description: 'Increment Prolongations (Fluency)', category: 'Data Entry' },
  { key: 'J', description: 'Increment Interjections (Fluency)', category: 'Data Entry' },
];

const categorizedHotkeys = hotkeys.reduce((acc, hotkey) => {
  if (!acc[hotkey.category]) {
    acc[hotkey.category] = [];
  }
  acc[hotkey.category].push(hotkey);
  return acc;
}, {} as Record<string, Hotkey[]>);

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <HelpCircle className="h-10 w-10 text-primary" />
            <div>
              <CardTitle className="text-3xl font-bold">Help & Guidance</CardTitle>
              <CardDescription>
                Welcome to {APP_NAME}! Here you'll find tips, hotkeys, and guidance to make the most of the application.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Keyboard className="text-primary"/>Keyboard Shortcuts (Hotkeys)</CardTitle>
          <CardDescription>Speed up your workflow with these keyboard shortcuts. On a Mac or iPad keyboard, Alt is the Option key. Data Entry keys apply to the focused goal of the focused student, and don't work while typing in a box or with a window open.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full" defaultValue={["Global Actions", "Data Entry"]}>
            {Object.entries(categorizedHotkeys).map(([category, keys]) => (
              <AccordionItem value={category} key={category}>
                <AccordionTrigger className="text-lg font-semibold">{category}</AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 divide-y divide-border">
                    {keys.map((hotkey) => (
                      <li key={hotkey.key} className="flex justify-between items-center pt-2">
                        <span className="text-muted-foreground">{hotkey.description}</span>
                        <kbd className="ml-4 px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-md dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">
                          {hotkey.key}
                        </kbd>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BookOpen className="text-primary"/>Application Guide</CardTitle>
          <CardDescription>General tips for using {APP_NAME}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <div>
            <h3 className="font-semibold text-foreground text-lg mb-1">Dashboard</h3>
            <p>The Dashboard provides an overview of your students, goal templates, and recent activity. Use it as your starting point.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-lg mb-1">Students</h3>
            <p>The "Students" page is now a selection grid. Choose a student to view their profile, where you can manage their details, assign goals from templates, or create custom goals for them. The sidebar also provides a quick progress overview for the selected student. Use the "Edit Student Info" button on the profile page, or the "Edit Student" modal (accessible from Data Entry via icon or Alt+E) for comprehensive goal management.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-lg mb-1">Goal Templates</h3>
            <p>Create and manage reusable goal templates. {AI_ENABLED ? " The page features an AI-powered semantic search: type your query and press Enter to find goals based on meaning. You can also generate a new template directly from your search query if you don't find what you're looking for." : ' Search by words in the goal name, goal text or skill area, and filter by skill area.'} These templates can then be assigned to multiple students.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-lg mb-1">Data Entry</h3>
            <p>Record session data for one or more students. Select students, enter activity details, and log performance for each assigned goal. The 'Qualitative Observation' goal type has been enhanced to include prompt level tracking, making it a flexible tool for various data collection scenarios. A new 'Feeding/Swallowing' goal type is also available for tracking trials. Use the hotkeys listed above for rapid data input.{AI_ENABLED && ' AI can also suggest activities based on goals and progress.'}</p>
             <p className="mt-1"><strong className="text-foreground">Communication Functions:</strong> Tally each communicative function (requesting, commenting, protesting, greeting, and more) as spontaneous (S) or prompted (P). Tap a button to add a use; press and hold, or right-click, to remove one. Progress is the number of different functions used spontaneously, compared with the goal&apos;s target number of functions.</p>
             <p className="mt-1"><strong className="text-foreground">Story Champs:</strong> Score each story part (Character, Setting, Problem, Feeling, Action, Ending, End Feeling) 0 = missing, 1 = partial, 2 = complete, and tally linking words (because, then, when, so, after, but). The story score is the percentage of the 14 possible points.</p>
             <p className="mt-1"><strong className="text-foreground">Behavior Data:</strong> <em>Frequency</em> goals count occurrences (tap to add, press and hold to remove); enter the observation time to see a rate per hour. <em>Duration</em> goals time each episode with Start/Stop, or add one by hand; saving the session stops a running timer. <em>ABC</em> goals record each incident by tapping an antecedent, a behavior and a consequence, then Add Incident; choose &quot;Used replacement skill&quot; when the student uses the taught skill instead. The antecedent, behavior and consequence choices can be edited in Settings → ABC Data Lists. <em>Interval</em> goals split the observation into equal intervals (choose partial interval, whole interval or momentary time sampling, the interval length and the number of intervals); tap each interval for + (behavior seen) or − (not seen). The timer highlights the current interval and can beep at each one. The result is the % of scored intervals with the behavior. <em>Latency</em> goals time how long the student takes to respond: tap Cue Given when you give the direction, then Responded (or No Response); the result is the average time to respond. Behavior goals can aim to <em>decrease</em> (the target is a maximum, the default) or <em>increase</em> (the target is a minimum); set this under Goal Direction when editing the goal. In Reports, each behavior goal is charted by its own measure against the target (see Goal by Goal below).</p>
             <p className="mt-1"><strong className="text-foreground">Unsaved work is kept:</strong> What you enter stays on Data Entry when you switch pages and come back, or if the app is closed, until you save or reset that student&apos;s session. Timers keep running in the meantime.</p>
             <p className="mt-1"><strong className="text-foreground">Note:</strong> Clicking a student's icon on their card or pressing Alt+E (when a student card is focused) will open the "Edit Student" modal, where you can manage their goals directly, assign new templates, or create custom goals{AI_ENABLED && ' with AI assistance'}.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-lg mb-1">Manage Sessions</h3>
            <p>Review, edit, or delete past session records. Filter sessions by student, date range, or keywords in activity/notes.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-lg mb-1">Analysis & Reports</h3>
            <p>Visualize student progress over time with charts for accuracy, response counts, opportunities, prompt usage, goal performance flow (Sankey), and correlations (Scatter Plot).{AI_ENABLED && ' Generate AI-powered technical summaries of student performance.'}</p>
            <p className="mt-1"><strong className="text-foreground">Goal by Goal:</strong> Each goal gets its own card showing the measure that fits its type (accuracy, % fluent, story score, functions used spontaneously, 1-5 rating, % independent, or a behavior measure) for each session, with a dashed target line and how many sessions met the target. Below the chart are breakdowns for the goal type: correct, approximate and incorrect responses; prompt levels; story part scores and linking words; uses by communication function; dysfluency types; or ABC antecedents, behaviors and functions; plus the most recent notes. Sessions where nothing was recorded for a goal are left out. Choose a goal at the top to see just that goal.</p>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lightbulb className="text-primary"/>General Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-muted-foreground">
            <p><strong className="text-foreground">Performance:</strong> The app now loads essential data first to be interactive quickly, while session history loads in the background.</p>
            <p><strong className="text-foreground">Data Storage:</strong> All data is stored on this device only. It is not synced to the cloud, so clearing browser data or removing the app will remove it.</p>
            <p><strong className="text-foreground">Backup &amp; Restore:</strong> In Settings, use Back Up Now to save all data to a file (keep it in Files, Google Drive, or email it to yourself). Restore from Backup loads that file on this or another device, either adding to the data already there or replacing it. The dashboard reminds you when there is no backup from the last week.</p>
            <p><strong className="text-foreground">Error Log:</strong> If you encounter issues, check the Error Log (Alt+J or header icon) for recent application-level errors. For more detailed debugging, use your browser's developer console.</p>
            {AI_ENABLED && <p><strong className="text-foreground">AI Features:</strong> Make use of AI for SMART goal generation (in Goal Templates & Edit Student modal) and activity suggestions (in Data Entry) to enhance your planning.</p>}
            <p><strong className="text-foreground">Ctrl+Enter:</strong> In many forms and on the Data Entry page, pressing Ctrl+Enter will act as a "confirm" or "save" action.</p>
            <p><strong className="text-foreground">Data Entry Focus:</strong> On the Data Entry page, student cards widen when focused. Click on a student card or use number keys (1-4) to focus.</p>
        </CardContent>
      </Card>
    </div>
  );
}
