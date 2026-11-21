'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart2, ClipboardList, HelpCircle, Keyboard, LifeBuoy, Rocket, Shield, Target, UserCog, ZoomIn } from 'lucide-react';
import { APP_NAME } from '@/lib/appConstants';
import { goalMeasureInfo } from '@/lib/goal-measures';
import { GOAL_TYPE_SCREENSHOTS } from '@/lib/goal-type-screenshots';
import { goalTypeLabel } from '@/lib/helpers';
import type { BuiltInGoalType } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useCustomGoalTypes } from '@/lib/custom-goal-types';
import { CUSTOM_MEASURE_KIND_INFO, customTypeSummary } from '@/lib/goal-types/custom';
import { ShowGettingStartedButton } from '@/components/dashboard/GettingStarted';

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
      { keys: 'Alt + 6', description: "What's New" },
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

// Each goal type: what its data entry records, and the measure reports chart (its label comes from goal-measures.ts).
const GOAL_TYPE_HELP: { type: BuiltInGoalType; does: string }[] = [
  { type: 'ARTICULATION', does: 'Count correct, approximate and incorrect productions of a target sound, from a word list or in conversation.' },
  { type: 'LANGUAGE_COMPREHENSION', does: 'Count questions answered correctly, incorrectly and approximately, with a note of the details asked for.' },
  { type: 'LANGUAGE_EXPRESSION', does: 'Count successful and unsuccessful responses, with a note of the target structure or vocabulary.' },
  { type: 'PHONOLOGICAL_PROCESSES', does: 'Choose the process being targeted, then count correct and incorrect productions and approximations.' },
  { type: 'AAC', does: 'Count correct, incorrect and approximate responses made with the device or system.' },
  { type: 'FEEDING_SWALLOWING', does: 'Count food or liquid trials accepted and refused, with the texture or consistency for each.' },
  { type: 'DISCRETE_TRIALS', does: 'Mark each trial on a grid as correct, approximate or incorrect; the number of trials can be set.' },
  { type: 'SEQUENCED_TRIALS', does: 'Mark each trial of a sequence on the grid, or enter the successful and failed attempts directly.' },
  { type: 'PROMPTING', does: 'Tally the prompt level of each response; the measure is the share given independently.' },
  { type: 'COGNITIVE', does: 'Give a 1–5 rating and tally the prompt level of each response, with notes.' },
  { type: 'QUALITATIVE_OBSERVATION', does: 'Give a 1–5 rating and tally the prompt level of each response, with notes.' },
  { type: 'COMMUNICATION_FUNCTIONS', does: 'Tally each function (requesting, protesting, commenting, greeting, and others) as spontaneous, emerging (an unprompted gesture, vocalization, approximation, or other form), or prompted. The measure counts every function used without a prompt (spontaneous or emerging).' },
  { type: 'FLUENCY_SYLLABLE_STUTTER', does: 'Count total syllables and each kind of dysfluency (repetitions, prolongations, blocks, interjections, secondary behaviors). The measure is the share of fluent syllables.' },
  { type: 'STORY_ELEMENTS', does: 'Score each story part (character, setting, problem, feeling, action, ending, end feeling) 0 (missing), 1 (partial) or 2 (complete), or N/A when it wasn’t assessed, and tally linking words (because, then, when, so, after, but). The measure is the share of points for the parts assessed; N/A parts are left out.' },
  { type: 'TASK_ANALYSIS', does: 'Score each step of a routine as Independent, with a prompt level, or Not done. The measure is the share of steps done independently.' },
  { type: 'LANGUAGE_SAMPLE', does: 'Record a language sample: tap the length of each utterance as the student says it (buttons 1 to 10; type longer ones), counted in words or morphemes as set in Edit Goal. The measure is the mean length of utterance (MLU). Reports also show how many utterances there were of each length, and each session’s sample size and longest utterance.' },
  { type: 'ITEM_MASTERY', does: 'Track a list of targets one by one (vocabulary, sight words, core words, signs, sounds), set in Edit Goal → Items. Mark each item tried as correct or incorrect (C and N mark the next item). The measure is the percentage of items tried that were correct, and an item counts as mastered once it is correct 3 sessions in a row. Reports show items mastered over time and a table of every item’s results.' },
  { type: 'GOAL_ATTAINMENT_SCALE', does: 'Pick the attainment level reached in the session, from −2 (much less than expected) to +2 (much more than expected); 0 is the expected outcome. The measure is the level itself, and the T-score (50 = expected) combines the student’s GAS goals over time.' },
  { type: 'COMMUNICATION_COUNT', does: 'Count each time the student uses a communication skill (a request, a comment, an utterance), with the observation time for a rate per hour. The same counter as Behavior Frequency, worded for communication; it aims to increase unless you set it to decrease.' },
  { type: 'COMMUNICATION_DURATION', does: 'Time how long the student stays with something (joint attention, play with a peer, engagement) with Start and Stop. The measure is the total minutes. The same timer as Behavior Duration, worded for communication.' },
  { type: 'RESPONSE_TIME', does: 'Time how long the student takes to respond after a question or prompt. The measure is the average in seconds, and a quicker response is the aim. The same timer as Behavior Latency, worded for communication.' },
  { type: 'COMMUNICATION_OPPORTUNITIES', does: 'Mark each opportunity on a grid as used (correct), approximate or not used, with prompt levels, for a skill the student should use when the moment comes up (asking for a break, saying how they feel). The measure is the percentage of opportunities.' },
  { type: 'BEHAVIOR_FREQUENCY', does: 'Count each occurrence, with the observation time for a rate per hour. Each tap records the time; Edit times corrects it.' },
  { type: 'BEHAVIOR_DURATION', does: 'Time each episode with Start and Stop. The measure is the total minutes. Edit times corrects when an episode started, or adds it for one entered by hand.' },
  { type: 'BEHAVIOR_INTERVAL', does: 'Score each interval with a timer as partial, whole or momentary. The measure is the share of intervals with the behavior.' },
  { type: 'BEHAVIOR_LATENCY', does: 'Time how long the student takes to respond after a cue. The measure is the average in seconds. Edit times corrects when each cue was given.' },
  { type: 'BEHAVIOR_ABC', does: 'Record each incident’s antecedents, behaviors and consequences (select as many as apply), and whether the replacement skill was used. Decrease goals chart the incidents; increase goals chart the share of incidents with the replacement skill. Edit times corrects when each incident happened. The lists can be edited in Settings.' },
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
  const [enlargedGoal, setEnlargedGoal] = useState<{ type: BuiltInGoalType; does: string } | null>(null);
  const { currentUser } = useAuth();
  const { customTypes } = useCustomGoalTypes(currentUser?.uid);

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
                stays on this device. See <Link href="/changelog" className="underline hover:text-primary">What&apos;s New</Link> for recent changes.
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
          <li><B>Set up.</B> When the app first opens on a new device it asks you to set a passcode, which encrypts the student data on the device; if the device already has data it asks you to save a backup first, and it then shows a recovery key once, which you should keep somewhere safe. You can continue without a passcode, but then anyone who opens the app can see the data. In <Link href="/settings" className="underline hover:text-primary">Settings</Link>, add your school or district name (it heads printed documents), check the school year dates, and turn Passcode Protection on or off at any time.</li>
          <li><B>Add students.</B> Use Add Student on the Dashboard, the + in the sidebar or <kbd>Alt + M</kbd>. Added from the Dashboard or the Students page, the new student&apos;s profile opens so you can give them goals; anywhere else, a message offers Add goals. On a student&apos;s profile, add IEP dates and required service minutes with Edit IEP Details. To add many at once, use <B>Settings → Import Students</B> with an IEP at a Glance PDF (a page per student) or a spreadsheet (Excel or CSV, one row per student): names, IEP dates, service minutes and goals come in together, and you check each goal&apos;s type before saving. Importing again (for example the PDF after the spreadsheet) updates the same students and skips goals they already have. If a student&apos;s IEP in the file has already ended, the import moves it to the current IEP year (starting the day after it ended, with the annual review a year less a day later); untick that in the review to keep the file&apos;s dates.</li>
          <li><B>Assign goals.</B> Pick goals from the goal bank on the student&apos;s profile (or write your own). Set the target, target date, baseline and mastery criteria when you edit a goal.</li>
          <li><B>Record sessions.</B> In <Link href="/data-entry" className="underline hover:text-primary">Data Entry</Link>, add students (or load a saved group), record data during the session, then Save All.</li>
          <li><B>Report.</B> In <Link href="/analysis-report" className="underline hover:text-primary">Reports</Link>, choose a student to see charts, write a narrative, or open the printable Progress Report.</li>
        </ol>
        <p>Until these steps are done, the Dashboard shows a Getting Started checklist that ticks each one off. If you hid it, bring it back here:</p>
        <ShowGettingStartedButton />
        <p>Back up regularly from Settings → Backup &amp; Restore. The <Link href="/dashboard" className="underline hover:text-primary">Dashboard</Link> reminds you when the last backup is more than a week old. It also shows <B>Today&apos;s Work</B> (unsaved Data Entry, and a button for each saved group that opens Data Entry with that group loaded), <B>Due Soon</B> (annual reviews and re-evaluations that are overdue or within 60 days) and <B>Service Minutes</B> (who still needs minutes this week or month, and who was short last time). The last two come from the IEP dates and required minutes on each student&apos;s profile; each shows 4 students at a time and scrolls for the rest, and tapping its title collapses it to the title and count (remembered on the device).</p>
      </Section>

      <Section id="data-entry" icon={ClipboardList} title="Data Entry">
        <Accordion type="multiple" defaultValue={['de-basics']}>
          <Topic value="de-basics" title="Recording a session">
            <p>Set the session date and start and end times at the top. Two buttons beside the date set the times in one tap: Reset Time to Now starts a session now (start at the current time, end 30 minutes later), and Reset Time to Before marks the 30 minutes that just ended (start 30 minutes ago, end at the current time), for recording a session that just happened. The start and end times are what count toward service minutes. On a student&apos;s card you can split a session&apos;s minutes between Related Service and AAC with Split by type, so each type counts toward its own requirement.</p>
            <p>Each student gets a card with their goals (<B>Add a Student</B> adds another card). Tap a card or press <kbd>1</kbd>–<kbd>4</kbd> to highlight it; the highlighted goal is outlined, and hotkeys add data to it. <B>Pick Student</B> and <B>Pick Goal</B> choose which card and goal are highlighted. Add an activity and notes, then use <B>Save Student</B> for the highlighted student or <B>Save All</B> (<kbd>Ctrl + Enter</kbd>).</p>
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
            <p>Choose a student on the <Link href="/student-profile" className="underline hover:text-primary">Students</Link> page. The <B>Overview</B> shows IEP dates (and how soon reviews are due), service minutes delivered against the IEP (per week, month or school year), and attendance for the school year. Use <B>Edit IEP Details</B> to set the dates and the required minutes, which can be set per service type (Related Service and AAC). <B>View Report</B> opens the Reports page for that student, with the Progress Report from there.</p>
            <p>Students you no longer see can be archived (kept, but hidden) or deleted.</p>
          </Topic>
          <Topic value="st-goals" title="Goals, targets and mastery">
            <p>Assign goals from the goal bank or write your own. When editing a goal you can set the <B>target</B> (e.g. 80%), whether the goal should increase or decrease, the <B>target date</B>, the <B>baseline</B> and when it was taken, and <B>mastery</B> (the target met in a number of sessions in a row, 3 by default).</p>
            <p><B>Custom goals.</B> On a student&apos;s profile, Assign / Create Goal → <B>Write a custom goal</B>. Type or paste the goal text (only that is needed): the name, goal type, target and target date are filled in from its wording (&quot;80% accuracy&quot;, &quot;4 out of 5&quot;, &quot;at least 3 functions&quot;, &quot;by May 2027&quot;, else the annual review), marked &quot;from the goal text&quot;. Change any that are wrong; a field you change stays as you set it. Set the baseline and mastery there too, and tick &quot;Also save as a template&quot; to give the same goal to other students later.</p>
            <p><B>Before you save</B>, Edit Goal (and the goal template editor) lists what saving will change, old value to new: the target, baseline, target date, data capture method, direction, task steps, GAS level descriptions, blank fills and the goal text. Nothing is listed when nothing changed.</p>
            <p><B>GAS goals.</B> A Goal Attainment Scale goal has five levels, from −2 (much less than expected) to +2 (much more than expected), with 0 as the expected outcome. Write what each level looks like for this student in Edit Goal → Level Descriptions (or in the template, so every student who gets it starts with them); Data Entry and reports then show those words with the levels. The target is a level from −2 to +2 (usually 0), and the baseline is usually −2.</p>
            <p><B>Placeholders</B> in goal text are filled in wherever the goal is shown (profile, Data Entry, reports): type them, or tap them under the goal text in Edit Goal, a template or a custom goal. [student] (first name, or &quot;the student&quot; in a template), [full name], [date] (the target date, or the annual review), [target] (such as 80%), [opportunities] (the target as &quot;4 out of 5&quot;), [sessions] (mastery), [baseline], [baseline date], [annual review], [IEP date], [re-evaluation] and [service minutes]. The goal keeps the placeholders, so its text follows the student and the goal&apos;s settings, and one template fits every student. &quot;STUDENT&quot; and &quot;the student&quot; are filled in with the name too.</p>
            <p><B>Blanks</B> in goal text (&quot;___&quot;) are filled in too. &quot;___%&quot; comes from the target, and so does &quot;___ out of ___&quot; when the goal has no percentage (80% shows as 4 out of 5), and &quot;___ consecutive&quot; comes from mastery; fill the others in Edit Goal → Fill in the Blanks. Numbers already written in the text follow the goal too, in goals from the bank and custom goals alike: change the target and &quot;80%&quot; (or &quot;80 percent&quot;) changes with it, and &quot;3 consecutive sessions&quot; follows mastery. The number of opportunities (&quot;4 out of 5 opportunities&quot;) is set separately and stays as written, unless it is the goal&apos;s only target (written &quot;4 out of 5&quot;, &quot;4/5 trials&quot; or &quot;8 of 10 times&quot;). Edit Goal previews the goal as it will be shown.</p>
          </Topic>
          <Topic value="st-bank" title="The goal bank">
            <p>The <Link href="/goal-templates" className="underline hover:text-primary">Goals</Link> page holds over 900 templates. Search by words in the name, goal text or skill area, filter by skill area, and open a goal to read the full text, its purpose and activity ideas. You can edit templates, add your own and archive ones you don&apos;t use.</p>
            <p><B>Built-in goals.</B> Turn on <B>Hide built-in goals</B> to see only your own templates. A built-in goal you never use can be deleted from its card; it then leaves the Goals page and the goal picker on this device. <B>Settings → Built-in goals</B> lists the ones you deleted, to restore one or all of them. Students who already have a goal keep it either way.</p>
            <p>The bank includes 20 GAS goals (language, communication functions, expressive language, behavior, social communication, AAC, self-advocacy and daily routines), each with all five levels written out.</p>
            <p>Every built-in goal is written the same way: &quot;By [date], the student will … with 80% accuracy across 3 consecutive sessions, as measured by SLP or teacher observation and data collection.&quot; The numbers follow the goal&apos;s target and mastery once it is assigned. Templates you have edited keep your wording.</p>
          </Topic>
        </Accordion>
      </Section>

      <Section id="goal-types" icon={Target} title="Goal types" description="Each goal type has its own data entry controls and its own measure in reports.">
        <p>Most types also tally the prompt level of each response (Independent, Visual, Verbal, Gestural, Partial physical, Imitation). Counter buttons add one with a tap; press and hold (or right-click) to take one away. Tap any screenshot below to enlarge it.</p>
        <p><B>Custom goal types.</B> You can create your own goal types in <Link href="/settings#custom-goal-types" className="underline hover:text-primary">Settings → Custom Goal Types</Link> (or directly from any goal type dropdown) using ten measurement methods: correct/incorrect tallies, counters, timers, custom rating scales, checklists, yes/no questions, and four that work like built-in types: prompt levels (like Prompting, measured as % independent), a trial grid (like Discrete Trials), response time (like Response Time, the average seconds) and utterance length (like Language Sample, the MLU). Under Charts in Reports, each type chooses whether its progress chart is a line or bars, and which extra charts that fit its measure appear under it in Reports.</p>
        {customTypes.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Your custom goal types on this device</p>
            <dl className="divide-y divide-border">
              {customTypes.map((ct) => (
                <div key={ct.id} className="py-2 first:pt-0 last:pb-0">
                  <dt className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: ct.color }} aria-hidden />
                    {ct.name}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({CUSTOM_MEASURE_KIND_INFO[ct.kind].label} · {customTypeSummary(ct)} · Measure: {goalMeasureInfo({ type: 'CUSTOM', customType: ct }).label})
                    </span>
                  </dt>
                  {ct.description && <dd className="text-xs text-muted-foreground mt-0.5">{ct.description}</dd>}
                </div>
              ))}
            </dl>
          </div>
        )}
        <dl className="divide-y divide-border">
          {[...GOAL_TYPE_HELP].sort((a, b) => goalTypeLabel(a.type).localeCompare(goalTypeLabel(b.type))).map(({ type, does }) => {
            const label = goalTypeLabel(type);
            const screenshot = GOAL_TYPE_SCREENSHOTS[type];
            return (
              <div
                key={type}
                id={`goal-type-${type.toLowerCase().replace(/_/g, '-')}`}
                className="grid gap-x-6 gap-y-2 py-5 scroll-mt-20 md:grid-cols-[minmax(0,1fr)_20rem] md:grid-rows-[auto_1fr] md:items-start"
              >
                <dt className="text-base font-semibold text-foreground md:col-start-1 md:row-start-1">
                  {label}
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Measure: {goalMeasureInfo({ type }).label}</span>
                </dt>
                <dd className="md:col-start-1 md:row-start-2">{does}</dd>
                <dd className="pt-1 md:col-start-2 md:row-start-1 md:row-span-2 md:pt-0">
                  <button
                    type="button"
                    onClick={() => setEnlargedGoal({ type, does })}
                    className="group block w-full max-w-[330px] overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label={`Enlarge ${label} data entry screenshot`}
                  >
                    <div className="bg-[#0a111f] p-1">
                      <Image
                        src={screenshot.src}
                        alt={`Example Data Entry card for ${label}`}
                        width={screenshot.width}
                        height={screenshot.height}
                        unoptimized
                        loading="lazy"
                        className="h-auto w-full rounded-sm"
                      />
                    </div>
                    <span
                      aria-hidden
                      className="flex items-center justify-end gap-1 border-t border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                      Tap to enlarge
                    </span>
                  </button>
                </dd>
              </div>
            );
          })}
        </dl>
      </Section>

      <Section id="reports" icon={BarChart2} title="Sessions and reports">
        <Accordion type="multiple">
          <Topic value="rp-sessions" title="Sessions">
            <p>The <Link href="/manage-sessions" className="underline hover:text-primary">Sessions</Link> page lists every saved session. Filter by student, dates or words in the activity and notes; view, edit or delete a session. Editing covers the data, notes, and the session&apos;s date and times: tap the date to open a calendar on the session&apos;s month.</p>
            <p><B>Merge Selected</B> joins the records of one session that was saved in parts (saved, then more data collected and saved again), so its minutes count once. Tick the records of the same student on the same day, then choose Merge Selected. Counts are added together; a note, rating or task step one part recorded is kept even when a later part left it empty.</p>
          </Topic>
          <Topic value="rp-charts" title="Charts and Goal by Goal">
            <p>On <Link href="/analysis-report" className="underline hover:text-primary">Reports</Link>, choose a student, a goal and a date range. Each goal gets a chart of its own measure, with the target line, the aim line (from the baseline to the target by the target date) and how many sessions met the target, plus breakdowns for its type (prompt levels, story parts, ABC patterns, time of day…). Tap (or hover over) a figure marked ⓘ, such as Average or Overall Accuracy, to see how it is worked out, with the numbers behind it. Tap a goal&apos;s title to read its full goal text.</p>
            <p><B>GAS goals</B> chart their level from −2 to +2 with an Expected line at 0, and a key under the chart says what each level means for that goal. When a student has GAS goals, a <B>Goal Attainment Scaling</B> section adds the <B>T-score over time</B> (all the student&apos;s GAS goals combined; 50 is the expected outcome, carrying each goal&apos;s latest level forward to each date), a <B>GAS summary</B> table and the <B>attainment-level distribution</B>.</p>
            <p><B>How the page is laid out.</B> <B>At a glance</B> lists every goal with its progress status, latest value, average, target, how often the target was met, trend and aim line; tap a goal&apos;s name to jump to its chart. <B>Goal by Goal</B> follows, then Goal Attainment Scaling. Charts that pool all goals together are under <B>All Goals Combined</B>, closed until you tap Show charts. Under the date picker, <B>Last 30 days</B>, <B>Last 9 weeks</B>, <B>School year</B> and <B>All</B> set the dates in one tap. The student, the date range and the goal chosen for each student are remembered on this device.</p>
            <p><B>Attendance.</B> The Attendance card at the bottom of Reports covers the student and date range you chose: sessions held and missed, the share held, and the student&apos;s own attendance (sessions missed because the provider was absent or there was no school are left out). A bar chart shows each month&apos;s held and missed sessions by reason, and a calendar marks each day (✓ held, ✕ missed); tap a day to see its sessions and any note.</p>
            <p><B>Few responses, less weight.</B> A session with 1 response out of 1 is 100%, the same as 5 out of 5, but says much less. On the all-goals <B>Progress Over Time</B> chart, larger dots had more opportunities and hollow dots had fewer than 5; tap a point to see its count (for example &ldquo;100% (1 of 1)&rdquo;). The dashed <B>Trend</B> line pools the responses of the last 3 sessions, so one short session moves it little. The trend in the written summary and the Progress Report counts each session by its number of opportunities in the same way.</p>
          </Topic>
          <Topic value="rp-narrative" title="Write Narrative">
            <p>Writes a progress summary of what is shown: for each goal, the sessions with data, the average and range, the latest result against the target, the trend, whether the student is on track with the aim line, and recent notes. Choose a brief or detailed style, edit it, then copy it or save it as a file.</p>
          </Topic>
          <Topic value="rp-progress" title="Printable Progress Report">
            <p>Reports → <B>Progress Report</B> makes a printable IEP progress report: each goal&apos;s text, target and target date, baseline, a chart, progress for the reporting period and a status. Change the report date and period, add comments, and optionally include service minutes. Print it or save it as PDF from the print dialog.</p>
          </Topic>
          <Topic value="rp-export" title="Exporting and importing session data">
            <p>Reports can export session data as a spreadsheet (CSV). A CSV file isn&apos;t protected, so keep it somewhere safe. Text that starts with = + - or @ is saved with a leading apostrophe, so a spreadsheet shows it as text rather than running it as a formula.</p>
            <p><B>Import Data</B> (on Reports and on a student&apos;s profile) adds sessions from a CSV in the same format, for example one exported on another device. Sessions already on the device are skipped, and missed sessions keep their reason.</p>
          </Topic>
        </Accordion>
      </Section>

      <Section id="data-safety" icon={Shield} title="Your data and privacy">
        <p><B>Stored on this device only.</B> {APP_NAME} has no account and no server. Student data stays in this browser or Home Screen app and is never sent anywhere. Read the <Link href="/privacy" className="underline hover:text-primary">Privacy Notice</Link> for details. The app asks the browser to keep its storage, so the device doesn&apos;t clear it to free space (the browser decides; a backup is still the only copy elsewhere).</p>
        <p><B>Back up.</B> Clearing browser data, deleting the Home Screen icon or losing the device deletes the data. Settings → Backup &amp; Restore saves everything to a file (you can protect it with a password); restoring adds to the data on a device or replaces it. Data in the Home Screen app is separate from data in Safari. If the device storage is full, the app shows a warning banner and any unsaved Data Entry work shows a warning with a button to try saving the draft again.</p>
        <p><B>Passcode Protection.</B> Settings → Passcode Protection encrypts student data on the device, including goal templates, student groups, and custom ABC lists. New installs are asked to set a passcode the first time the app opens; on a device that already has student data, the app offers it once instead and never locks existing data behind a passcode. Before turning it on where data already exists, the app asks you to save a backup first; you can decline and continue, but a backup is the only safety net if the data is later damaged. Setting a passcode shows a recovery key once: keep it somewhere safe, since it unlocks the app and lets you set a new passcode if you forget the old one. Without the passcode or the recovery key, the data can only be erased and restored from a backup. The app locks after a period of inactivity (5 to 60 minutes) and asks for the passcode; choose <B>As soon as the app is put away</B> under Lock after to lock it whenever you switch to another app or the screen turns off. Going without a passcode takes a second confirmation, so it can&apos;t be chosen by accident. Turning the passcode on encrypts everything already saved, not only new work. If a saved list is damaged and can&apos;t be read, the passcode can&apos;t be turned off until a backup is restored, so the key is never removed from data that still needs it.</p>
        <p><B>If the app says some saved data couldn&apos;t be opened just now,</B> the device&apos;s storage didn&apos;t answer (this happens now and then on iPads). Close the app completely (swipe it away) and open it again. Don&apos;t restore a backup over it: the data is usually fine, and restoring would replace any newer work. Saving is paused until the data opens.</p>
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
            <p>Updates download in the background and apply the next time the app opens. Close the app fully (swipe it away on an iPad) and open it again. <Link href="/changelog" className="underline hover:text-primary">What&apos;s New</Link> (in the account menu) lists what changed.</p>
          </Topic>
          <Topic value="ts-offline" title="Using it without internet">
            <p>After it has been opened once online, the app works offline. Open it from the Home Screen while online now and then to get updates.</p>
          </Topic>
          <Topic value="ts-size" title="Text or buttons are too small or too large">
            <p>Settings → Interface → Theme changes the app&apos;s colors: Dark (navy and gold), Light (white and gold, for bright rooms), High Contrast (black, white and bright yellow, for low vision) or Pastel (soft lavender, baby blue and mint). It is saved on this device; printed reports stay black on white.</p>
            <p>Settings → Interface → Display Size changes the size of everything. You can also move the menu bar to the bottom of the screen (it stays in reach while you scroll, with the footer below it at the end of a page) or hide the student sidebar there.</p>
          </Topic>
          <Topic value="ts-tabs" title="The app is open in two tabs or windows">
            <p>Saved data is shared: a save in one updates the other within a moment. Record a session in only one of them, though: unsaved Data Entry work is a single draft on the device, so two tabs would overwrite each other&apos;s draft.</p>
          </Topic>
          <Topic value="ts-hotkeys" title="Letters I type set off shortcuts">
            <p>Turn off single-key shortcuts in Settings → Interface. The Alt shortcuts and Ctrl + Enter keep working.</p>
          </Topic>
          <Topic value="ts-error" title="Something went wrong">
            <p>The error log (<kbd>Alt + J</kbd>, or the icon in the header) lists recent errors with details you can copy when reporting a problem. If data looks wrong, restore your latest backup.</p>
          </Topic>
        </Accordion>
      </Section>

      <Dialog open={enlargedGoal !== null} onOpenChange={(open) => { if (!open) setEnlargedGoal(null); }}>
        {enlargedGoal && (() => {
          const label = goalTypeLabel(enlargedGoal.type);
          const screenshot = GOAL_TYPE_SCREENSHOTS[enlargedGoal.type];
          return (
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{label}</DialogTitle>
                <DialogDescription>
                  <span className="block font-medium text-foreground">
                    Measure: {goalMeasureInfo({ type: enlargedGoal.type }).label}
                  </span>
                  <span className="mt-1 block">{enlargedGoal.does}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border border-border bg-[#0a111f] p-1.5">
                <Image
                  src={screenshot.src}
                  alt={`Example Data Entry card for ${label}`}
                  width={screenshot.width}
                  height={screenshot.height}
                  unoptimized
                  className="mx-auto h-auto w-full max-w-[420px] rounded-sm"
                />
              </div>
            </DialogContent>
          );
        })()}
      </Dialog>
    </div>
  );
}
