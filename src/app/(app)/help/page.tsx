'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BarChart2, ClipboardList, HelpCircle, Keyboard, LifeBuoy, Rocket, Shield, Target, UserCog } from 'lucide-react';
import { APP_NAME } from '@/lib/appConstants';

// Help: getting started, a guide to each page, the goal types, data safety, hotkeys and troubleshooting.
// The hotkey lists are kept in sync with use-keyboard-shortcuts.ts, DataEntryContent.tsx and data-entry-hotkeys.ts.

interface Hotkey { keys: string; description: string }

const HOTKEYS: { group: string; note?: string; keys: Hotkey[] }[] = [
  {
    group: 'Anywhere in the app',
    keys: [
      { keys: 'Alt + D', description: 'Dashboard' },
      { keys: 'Alt + 1', description: 'Data Entry' },
      { keys: 'Alt + 2', description: 'Sessions' },
      { keys: 'Alt + 3', description: 'Reports' },
      { keys: 'Alt + 4', description: 'Students' },
      { keys: 'Alt + 5', description: 'Goals' },
      { keys: 'Alt + 6', description: 'Changelog' },
      { keys: 'Alt + 7', description: 'Settings' },
      { keys: 'Alt + H', description: 'Help (this page)' },
      { keys: 'Alt + M', description: 'Add a student' },
      { keys: 'Alt + K', description: 'Show or hide the student sidebar' },
      { keys: 'Alt + J', description: 'Error log' },
    ],
  },
  {
    group: 'Data Entry: students and goals',
    keys: [
      { keys: 'Ctrl + Enter', description: 'Save all students (Cmd + Enter on Apple keyboards; works while typing)' },
      { keys: '1 – 4', description: 'Focus the student in that slot' },
      { keys: 'A / Alt + A', description: 'Next / previous student' },
      { keys: 'S / Alt + S', description: 'Next / previous goal of the focused student' },
      { keys: 'Alt + W', description: 'Add a student slot' },
      { keys: 'Alt + Q', description: 'Remove the focused student slot' },
      { keys: 'Alt + U', description: 'Choose a student' },
      { keys: 'Alt + T', description: 'Choose a goal' },
      { keys: 'Alt + E', description: 'Edit the focused student and their goals' },
      { keys: 'Alt + L', description: 'Student Access Lock on or off' },
    ],
  },
  {
    group: 'Data Entry: recording data',
    note: 'These add to the focused goal of the focused student. Single-letter keys can be turned off in Settings → Interface.',
    keys: [
      { keys: 'C', description: 'Correct (next trial correct on trial grids; one occurrence for behavior frequency; Independent for task analysis steps)' },
      { keys: 'N', description: 'Incorrect (next trial incorrect; Not done for task analysis steps)' },
      { keys: 'B', description: 'Approximate (next trial approximate); a block for fluency goals' },
      { keys: 'I', description: 'Independent (also counts as correct)' },
      { keys: 'D', description: 'Visual prompt' },
      { keys: 'V', description: 'Verbal prompt' },
      { keys: 'G', description: 'Gestural prompt' },
      { keys: 'P', description: 'Partial physical prompt' },
      { keys: 'F', description: 'Imitation (model) prompt' },
      { keys: 'R / H / J', description: 'Fluency: repetition / prolongation / interjection' },
    ],
  },
];

const GOAL_TYPES: [string, string][] = [
  ['Articulation, language, phonological processes, AAC', 'Count correct, approximate and incorrect responses. The measure is accuracy (% correct).'],
  ['Discrete and sequenced trials', 'Score each trial on a grid (correct, approximate, incorrect), or count attempts of a set length.'],
  ['Prompting and cognitive', 'Tally the prompt level of each response; cognitive goals also take a 1–5 rating.'],
  ['Fluency', 'Count syllables and each kind of dysfluency (repetitions, prolongations, blocks, interjections). The measure is % fluent.'],
  ['Qualitative observation', 'A 1–5 rating, prompt levels and notes.'],
  ['Feeding and swallowing', 'Trials accepted and refused for each food or liquid and texture.'],
  ['Communication functions', 'Tally each function (requesting, commenting, protesting, greeting…) as spontaneous or prompted. The measure is the number of functions used spontaneously.'],
  ['Story elements', 'Score each story part (character, setting, problem, feeling, action, ending, end feeling) 0 (missing), 1 (partial) or 2 (complete) and tally linking words. The measure is % of the 14 points.'],
  ['Task analysis', 'Score each step of a routine as Independent, a prompt level, or Not done. The measure is % of steps done independently.'],
  ['Behavior: frequency and duration', 'Count occurrences (with observation time for a rate per hour), or time each episode with Start and Stop.'],
  ['Behavior: ABC', 'Record each incident’s antecedents, behaviors and consequences (select as many of each as apply), and whether the replacement skill was used. The lists can be edited in Settings.'],
  ['Behavior: interval and latency', 'Score partial, whole or momentary intervals with a timer, or time how long the student takes to respond after a cue.'],
];

function Section({ id, icon: Icon, title, description, children }: {
  id: string; icon: typeof HelpCircle; title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="flex items-center gap-2 text-xl"><Icon className="h-5 w-5 text-primary" aria-hidden />{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

const B = ({ children }: { children: React.ReactNode }) => <strong className="font-semibold text-foreground">{children}</strong>;

function Topic({ value, title, children }: { value: string; title: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger className="text-base font-semibold text-foreground">{title}</AccordionTrigger>
      <AccordionContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</AccordionContent>
    </AccordionItem>
  );
}

const CONTENTS: [string, string][] = [
  ['start', 'Getting started'],
  ['data-entry', 'Data Entry'],
  ['students', 'Students and goals'],
  ['goal-types', 'Goal types'],
  ['reports', 'Sessions and reports'],
  ['data-safety', 'Your data and privacy'],
  ['hotkeys', 'Keyboard shortcuts'],
  ['troubleshooting', 'Troubleshooting'],
];

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <HelpCircle className="h-10 w-10 shrink-0 text-primary" aria-hidden />
            <div>
              <CardTitle role="heading" aria-level={1} className="text-3xl font-bold">Help</CardTitle>
              <CardDescription>
                How to use {APP_NAME} to record session data, track IEP goals and write progress reports. Everything
                stays on this device.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <nav aria-label="On this page">
            <ul className="flex flex-wrap gap-2 text-sm">
              {CONTENTS.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="inline-block rounded-full border px-3 py-1 hover:border-primary hover:text-primary">{label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </CardContent>
      </Card>

      <Section id="start" icon={Rocket} title="Getting started" description="Five steps from a new device to your first progress report.">
        <ol className="list-decimal space-y-2 pl-5">
          <li><B>Set up.</B> In <Link href="/settings" className="underline hover:text-primary">Settings</Link>, add your school or district name (it heads printed documents), check the school year dates, and consider turning on Passcode Protection.</li>
          <li><B>Add students.</B> Press <kbd>Alt + M</kbd> or use the + in the sidebar. On a student&apos;s profile, add IEP dates and required service minutes with Edit IEP Details. To add many at once, use <B>Settings → Import Students</B> with an IEP at a Glance PDF (a page per student) or a spreadsheet (Excel or CSV, one row per student): names, IEP dates, service minutes and goals come in together, and you check each goal&apos;s type before saving. Importing again (for example the PDF after the spreadsheet) updates the same students and skips goals they already have.</li>
          <li><B>Assign goals.</B> Pick goals from the goal bank on the student&apos;s profile (or write your own). Set the target, target date, baseline and mastery criteria when you edit a goal.</li>
          <li><B>Record sessions.</B> In <Link href="/data-entry" className="underline hover:text-primary">Data Entry</Link>, add students (or load a saved group), record data during the session, then Save All.</li>
          <li><B>Report.</B> In <Link href="/analysis-report" className="underline hover:text-primary">Reports</Link>, choose a student to see charts, write a narrative, or open the printable Progress Report.</li>
        </ol>
        <p>Back up regularly from Settings → Backup &amp; Restore. The <Link href="/dashboard" className="underline hover:text-primary">Dashboard</Link> reminds you when the last backup is more than a week old. It also shows <B>Today&apos;s Work</B> (unsaved Data Entry, and a button for each saved group that opens Data Entry with that group loaded), <B>Due Soon</B> (annual reviews and re-evaluations that are overdue or within 60 days) and <B>Service Minutes</B> (who still needs minutes this week or month, and who was short last time). The last two come from the IEP dates and required minutes on each student&apos;s profile.</p>
      </Section>

      <Section id="data-entry" icon={ClipboardList} title="Data Entry">
        <Accordion type="multiple" defaultValue={['de-basics']}>
          <Topic value="de-basics" title="Recording a session">
            <p>Set the session date and start and end times at the top (Reset Time to Now starts the clock again). The start and end times are what count toward service minutes.</p>
            <p>Each student gets a card with their goals. Tap a card or press <kbd>1</kbd>–<kbd>4</kbd> to focus it; the focused goal is outlined, and hotkeys add data to it. Add an activity and notes, then use <B>Save Focused</B> for one student or <B>Save All</B> (<kbd>Ctrl + Enter</kbd>).</p>
            <p>Unsaved work is kept if you switch pages or close the app, until you save or reset it. Timers keep running meanwhile.</p>
          </Topic>
          <Topic value="de-students" title="Adding students and groups">
            <p>Use <B>Add Student</B> on the bottom bar or the Student button to fill a slot. There is no limit on slots; the arrows in the middle of the bottom bar scroll the cards one at a time.</p>
            <p><B>Editing a student&apos;s goals:</B> the student button at the top of a card (<kbd>Alt + E</kbd>) opens Edit Student. There you can edit a goal (pencil), archive or remove it, or assign another. What is entered on the card is kept.</p>
            <p><B>Groups</B> load a class or small group in one step: Load Group → Manage Groups… to create one, then choose it from Load Group. Groups are included in backups. <B>Remove All</B> (next to Load Group) empties Data Entry after asking; if anyone has unsaved data it names them, so you can Save All instead.</p>
          </Topic>
          <Topic value="de-missed" title="Missed sessions">
            <p>The calendar icon on a student&apos;s card records a missed session with the reason (student absent or unavailable, provider absent, no school…). Missed sessions show in attendance and don&apos;t count as service minutes.</p>
          </Topic>
          <Topic value="de-lock" title="Student Access Lock">
            <p>When a student uses the iPad, turn on the Student Access Lock (<kbd>Alt + L</kbd>). Data can&apos;t be changed and other students can&apos;t be opened until the lock is turned off with your PIN.</p>
          </Topic>
        </Accordion>
      </Section>

      <Section id="students" icon={UserCog} title="Students and goals">
        <Accordion type="multiple">
          <Topic value="st-profile" title="Student profiles">
            <p>Choose a student on the <Link href="/student-profile" className="underline hover:text-primary">Students</Link> page. The <B>Overview</B> shows IEP dates (and how soon reviews are due), service minutes delivered against the IEP (per week, month or school year), and attendance for the school year. Use <B>Edit IEP Details</B> to set the dates and required minutes. <B>View Report</B> opens the Reports page for that student, with the Progress Report from there.</p>
            <p>Students you no longer see can be archived (kept, but hidden) or deleted.</p>
          </Topic>
          <Topic value="st-goals" title="Goals, targets and mastery">
            <p>Assign goals from the goal bank or write your own. When editing a goal you can set the <B>target</B> (e.g. 80%), whether the goal should increase or decrease, the <B>target date</B>, the <B>baseline</B> and when it was taken, and <B>mastery</B> (the target met in a number of sessions in a row, 3 by default).</p>
            <p>Write &quot;By [date]&quot; and &quot;STUDENT&quot; in goal text: they are filled in with the goal&apos;s target date and the student&apos;s name on reports.</p>
            <p><B>Blanks</B> in goal text (&quot;___&quot;) are filled in too. &quot;___%&quot; comes from the target, and so does &quot;___ out of ___&quot; when the goal has no percentage (80% shows as 4 out of 5), and &quot;___ consecutive&quot; comes from mastery; fill the others in Edit Goal → Fill in the Blanks. Numbers already written in the text follow the goal too, in goals from the bank and custom goals alike: change the target and &quot;80%&quot; (or &quot;80 percent&quot;) changes with it, and &quot;3 consecutive sessions&quot; follows mastery. The number of opportunities (&quot;4 out of 5 opportunities&quot;) is set separately and stays as written, unless it is the goal&apos;s only target (written &quot;4 out of 5&quot;, &quot;4/5 trials&quot; or &quot;8 of 10 times&quot;). Edit Goal previews the goal as it will be shown.</p>
          </Topic>
          <Topic value="st-bank" title="The goal bank">
            <p>The <Link href="/goal-templates" className="underline hover:text-primary">Goals</Link> page holds over 900 templates. Search by words in the name, goal text or skill area, filter by skill area, and open a goal to read the full text, its purpose and activity ideas. You can edit templates, add your own and archive ones you don&apos;t use.</p>
            <p>Every built-in goal is written the same way: &quot;By [date], the student will … with 80% accuracy across 3 consecutive sessions, as measured by SLP or teacher observation and data collection.&quot; The numbers follow the goal&apos;s target and mastery once it is assigned. Templates you have edited keep your wording.</p>
          </Topic>
        </Accordion>
      </Section>

      <Section id="goal-types" icon={Target} title="Goal types" description="Each goal type has its own data entry controls and its own measure in reports.">
        <dl className="divide-y divide-border">
          {GOAL_TYPES.map(([name, text]) => (
            <div key={name} className="grid gap-1 py-2 sm:grid-cols-[16rem_1fr] sm:gap-4">
              <dt className="font-semibold text-foreground">{name}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
        <p>Counter buttons add one with a tap; press and hold (or right-click) to take one away.</p>
      </Section>

      <Section id="reports" icon={BarChart2} title="Sessions and reports">
        <Accordion type="multiple">
          <Topic value="rp-sessions" title="Sessions">
            <p>The <Link href="/manage-sessions" className="underline hover:text-primary">Sessions</Link> page lists every saved session. Filter by student, dates or words in the activity and notes; view, edit or delete a session. Editing covers the data, notes, and the session&apos;s date and times: tap the date to open a calendar on the session&apos;s month.</p>
            <p><B>Merge Selected</B> joins the records of one session that was saved in parts (saved, then more data collected and saved again), so its minutes count once. Tick the records of the same student on the same day, then choose Merge Selected.</p>
          </Topic>
          <Topic value="rp-charts" title="Charts and Goal by Goal">
            <p>On <Link href="/analysis-report" className="underline hover:text-primary">Reports</Link>, choose a student, a goal and a date range. Each goal gets a chart of its own measure, with the target line, the aim line (from the baseline to the target by the target date) and how many sessions met the target, plus breakdowns for its type (prompt levels, story parts, ABC patterns, time of day…).</p>
          </Topic>
          <Topic value="rp-narrative" title="Write Narrative">
            <p>Writes a progress summary of what is shown: for each goal, the sessions with data, the average and range, the latest result against the target, the trend, whether the student is on track with the aim line, and recent notes. Choose a brief or detailed style, edit it, then copy it or save it as a file.</p>
          </Topic>
          <Topic value="rp-progress" title="Printable Progress Report">
            <p>Reports → <B>Progress Report</B> makes a printable IEP progress report: each goal&apos;s text, target and target date, baseline, a chart, progress for the reporting period and a status. Change the report date and period, add comments, and optionally include service minutes. Print it or save it as PDF from the print dialog.</p>
          </Topic>
          <Topic value="rp-export" title="Exporting data">
            <p>Reports can export session data as a spreadsheet (CSV). A CSV file isn&apos;t protected, so keep it somewhere safe.</p>
          </Topic>
        </Accordion>
      </Section>

      <Section id="data-safety" icon={Shield} title="Your data and privacy">
        <p><B>Stored on this device only.</B> {APP_NAME} has no account and no server. Student data stays in this browser or Home Screen app and is never sent anywhere. Read the <Link href="/privacy" className="underline hover:text-primary">Privacy Notice</Link> for details.</p>
        <p><B>Back up.</B> Clearing browser data, deleting the Home Screen icon or losing the device deletes the data. Settings → Backup &amp; Restore saves everything to a file (you can protect it with a password); restoring adds to the data on a device or replaces it. Data in the Home Screen app is separate from data in Safari.</p>
        <p><B>Passcode Protection.</B> Settings → Passcode Protection encrypts student data on the device. The app locks after a period of inactivity and asks for the passcode. A forgotten passcode can&apos;t be recovered: the data can only be erased and restored from a backup.</p>
        <p><B>Deleting data.</B> Settings → Delete Data removes student data from this device, for example at the end of the year or before handing on a device.</p>
      </Section>

      <Section id="hotkeys" icon={Keyboard} title="Keyboard shortcuts" description="On a Mac or iPad keyboard, Alt is the Option key. Shortcuts don't run while you are typing in a box or a window is open.">
        <Accordion type="multiple" defaultValue={HOTKEYS.map(h => h.group)}>
          {HOTKEYS.map(({ group, note, keys }) => (
            <AccordionItem value={group} key={group}>
              <AccordionTrigger className="text-base font-semibold text-foreground">{group}</AccordionTrigger>
              <AccordionContent>
                {note && <p className="mb-2 text-sm text-muted-foreground">{note}</p>}
                <ul className="divide-y divide-border text-sm">
                  {keys.map(k => (
                    <li key={k.keys} className="flex items-center justify-between gap-4 py-2">
                      <span className="text-muted-foreground">{k.description}</span>
                      <kbd className="shrink-0 rounded-md border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800 dark:border-gray-500 dark:bg-gray-600 dark:text-gray-100">{k.keys}</kbd>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Section>

      <Section id="troubleshooting" icon={LifeBuoy} title="Troubleshooting">
        <Accordion type="multiple">
          <Topic value="ts-update" title="I don't see the latest changes">
            <p>Updates download in the background and apply the next time the app opens. Close the app fully (swipe it away on an iPad) and open it again. The <Link href="/changelog" className="underline hover:text-primary">Changelog</Link> lists what changed.</p>
          </Topic>
          <Topic value="ts-offline" title="Using it without internet">
            <p>After it has been opened once online, the app works offline. Open it from the Home Screen while online now and then to get updates.</p>
          </Topic>
          <Topic value="ts-size" title="Text or buttons are too small or too large">
            <p>Settings → Interface → Display Size changes the size of everything. You can also move the menu bar to the bottom of the screen (it stays in reach while you scroll, with the footer below it at the end of a page) or hide the student sidebar there.</p>
          </Topic>
          <Topic value="ts-hotkeys" title="Letters I type set off shortcuts">
            <p>Turn off single-key shortcuts in Settings → Interface. The Alt shortcuts and Ctrl + Enter keep working.</p>
          </Topic>
          <Topic value="ts-error" title="Something went wrong">
            <p>The error log (<kbd>Alt + J</kbd>, or the icon in the header) lists recent errors with details you can copy when reporting a problem. If data looks wrong, restore your latest backup.</p>
          </Topic>
        </Accordion>
      </Section>
    </div>
  );
}
