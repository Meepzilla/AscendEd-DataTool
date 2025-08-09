
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle, Keyboard, BookOpen, Lightbulb } from 'lucide-react';
import { APP_NAME } from '@/lib/appConstants';

interface Hotkey {
  key: string;
  description: string;
  category: string;
}

const hotkeys: Hotkey[] = [
  // Global Navigation
  { key: 'Alt + D', description: 'Navigate to Dashboard', category: 'Global Navigation' },
  { key: 'Alt + 1', description: 'Navigate to Student Profile', category: 'Global Navigation' },
  { key: 'Alt + 2', description: 'Navigate to Goal Templates', category: 'Global Navigation' },
  { key: 'Alt + 3', description: 'Navigate to Data Entry', category: 'Global Navigation' },
  { key: 'Alt + 4', description: 'Navigate to Manage Sessions', category: 'Global Navigation' },
  { key: 'Alt + 5', description: 'Navigate to Analysis & Reports', category: 'Global Navigation' },
  // Global Actions
  { key: 'Alt + H', description: 'Open this Help Page', category: 'Global Actions' },
  { key: 'Alt + L', description: 'Open Error Log Modal', category: 'Global Actions' },
  { key: 'Alt + M', description: 'Open Add Student Modal', category: 'Global Actions' },
  { key: 'Alt + B', description: 'Toggle Sidebar', category: 'Global Actions'},
  { key: 'Ctrl + Enter', description: 'Confirm action / Save (contextual)', category: 'Global Actions'},
  // Data Entry Specific
  { key: '1, 2, 3, or 4', description: 'Focus on Student Slot 1-4', category: 'Data Entry' },
  { key: 'A', description: 'Cycle to Next Student Slot', category: 'Data Entry' },
  { key: 'Alt + A', description: 'Cycle to Previous Student Slot', category: 'Data Entry' },
  { key: 'S', description: 'Cycle to Next Goal (for focused student)', category: 'Data Entry' },
  { key: 'Alt + S', description: 'Cycle to Previous Goal (for focused student)', category: 'Data Entry' },
  { key: 'C', description: 'Increment Correct / Total Syllables / Trials Accepted / Slider Right', category: 'Data Entry' },
  { key: 'Alt + C', description: 'Decrement Correct / Total Syllables / Trials Accepted', category: 'Data Entry' },
  { key: 'B', description: 'Increment Approximate count', category: 'Data Entry' },
  { key: 'Alt + B', description: 'Decrement Approximate count', category: 'Data Entry' },
  { key: 'N', description: 'Increment Incorrect / Stuttered Syllables / Trials Refused / Slider Left', category: 'Data Entry' },
  { key: 'Alt + N', description: 'Decrement Incorrect / Stuttered Syllables / Trials Refused', category: 'Data Entry' },
  { key: 'D', description: 'Increment Visual Prompt count', category: 'Data Entry' },
  { key: 'Alt + D', description: 'Decrement Visual Prompt count', category: 'Data Entry' },
  { key: 'V', description: 'Increment Verbal Prompt count', category: 'Data Entry' },
  { key: 'Alt + V', description: 'Decrement Verbal Prompt count', category: 'Data Entry' },
  { key: 'G', description: 'Increment Gestural Prompt count', category: 'Data Entry' },
  { key: 'Alt + G', description: 'Decrement Gestural Prompt count', category: 'Data Entry' },
  { key: 'P', description: 'Increment Partial Physical Prompt count', category: 'Data Entry' },
  { key: 'Alt + P', description: 'Decrement Partial Physical Prompt count', category: 'Data Entry' },
  { key: 'F', description: 'Increment Full Physical Prompt count', category: 'Data Entry' },
  { key: 'Alt + F', description: 'Decrement Full Physical Prompt count', category: 'Data Entry' },
  { key: 'I', description: 'Increment Independent count (also increments main Correct count)', category: 'Data Entry' },
  { key: 'Alt + I', description: 'Decrement Independent count (also decrements main Correct count)', category: 'Data Entry' },
  { key: 'Alt + E', description: 'Edit focused student\'s info/goals (from Data Entry page)', category: 'Data Entry' },
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
          <CardDescription>Speed up your workflow with these keyboard shortcuts.</CardDescription>
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
            <h3 className="font-semibold text-foreground text-lg mb-1">Student Profile</h3>
            <p>Manage individual student details, assign goals from templates, or create custom goals for them. The sidebar shows a quick progress overview for the selected student. Use the "Edit Student Info" button, or the "Edit Student" modal (accessible from Data Entry via icon or Alt+E) for comprehensive goal management.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-lg mb-1">Goal Templates</h3>
            <p>Create and manage reusable goal templates, including for the new "Feeding/Swallowing" type. Use the AI feature to help generate SMART goals from your prompts. These templates can then be assigned to multiple students.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-lg mb-1">Data Entry</h3>
            <p>Record session data for one or more students. Select students, enter activity details, and log performance for each assigned goal. The 'Qualitative Observation' goal type has been enhanced to include prompt level tracking, making it a flexible tool for various data collection scenarios. A new 'Feeding/Swallowing' goal type is also available for tracking trials. Use the hotkeys listed above for rapid data input. AI can also suggest activities based on goals and progress.</p>
             <p className="mt-1"><strong className="text-foreground">Note:</strong> Clicking a student's icon on their card or pressing Alt+E (when a student card is focused) will open the "Edit Student" modal, where you can manage their goals directly, assign new templates, or create custom goals with AI assistance.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-lg mb-1">Manage Sessions</h3>
            <p>Review, edit, or delete past session records. Filter sessions by student, date range, or keywords in activity/notes.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-lg mb-1">Analysis & Reports</h3>
            <p>Visualize student progress over time with charts for accuracy, response counts, opportunities, prompt usage, goal performance flow (Sankey), and correlations (Scatter Plot). Generate AI-powered technical summaries of student performance.</p>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lightbulb className="text-primary"/>General Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-muted-foreground">
            <p><strong className="text-foreground">Performance:</strong> The app now loads essential data first to be interactive quickly, while session history loads in the background.</p>
            <p><strong className="text-foreground">Local Mode:</strong> If Firebase is not configured (e.g., missing API keys), the app runs in local mode. Data is stored in your browser and not synced to the cloud. You'll see indicators for this.</p>
            <p><strong className="text-foreground">Error Log:</strong> If you encounter issues, check the Error Log (Alt+L or header icon) for recent application-level errors. For more detailed debugging, use your browser's developer console.</p>
            <p><strong className="text-foreground">AI Features:</strong> Make use of AI for SMART goal generation (in Goal Templates & Edit Student modal) and activity suggestions (in Data Entry) to enhance your planning.</p>
            <p><strong className="text-foreground">Ctrl+Enter:</strong> In many forms and on the Data Entry page, pressing Ctrl+Enter will act as a "confirm" or "save" action.</p>
            <p><strong className="text-foreground">Data Entry Focus:</strong> On the Data Entry page, student cards widen when focused. Click on a student card or use number keys (1-4) to focus.</p>
        </CardContent>
      </Card>
    </div>
  );
}
