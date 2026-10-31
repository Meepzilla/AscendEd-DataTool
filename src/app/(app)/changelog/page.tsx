
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { RotateCcw, ScrollText, GitMerge, Zap, Bug, PlusCircle, Pencil, ArrowUpDown, BarChartHorizontalBig, KeyboardIcon, Smartphone, Trash2, LayoutGrid, Minimize2, UserX, UserPlus, ArrowRightLeft, Lightbulb, Download, ListPlus, Workflow, Shuffle, CheckSquare, ListChecks, DatabaseZap, UserSearch, Upload, BrainCircuit, PanelLeft, ArrowLeft, MessagesSquare, BookOpen, Lock, ShieldCheck, PanelBottom } from 'lucide-react';
import { APP_NAME } from '@/lib/appConstants';

interface ChangelogEntry {
  version?: string; // Optional version number
  date: string;
  title: string;
  description: string;
  type: 'feature' | 'improvement' | 'fix' | 'hotkey';
  icon: React.ElementType;
}

const allChangelogEntries: ChangelogEntry[] = [
  {
    date: '2026-10-31',
    title: 'Netlify Badge Workaround Removed',
    description: 'The live app is hosted on Cloudflare, which doesn\'t add a corner badge, so the code that hid the "Powered by Netlify" badge and the space kept clear for it are gone: the Data Entry bottom bar uses its full width on wide screens. Netlify is still used for test previews, where the badge may show.',
    type: 'improvement',
    icon: ScrollText,
  },
  {
    date: '2026-10-31',
    title: 'Fixes from a Code Review',
    description: 'Merging sessions no longer adds up values that aren\'t counts: interval length, % of intervals and average latency are worked out again from the combined data, and Story Champs parts keep their best score instead of being added. The Sessions page clears ticked sessions when the filters change, so only sessions you can see are merged. Report narratives start the aim line at the goal\'s first session (as the Reports chart does) and the brief style counts latency sessions without a response. Passcode protection: turning it on, changing the passcode or turning it off no longer loses data saved at the same moment, a failed restore puts damaged data back exactly as it was stored, and the lock screen shows a message instead of getting stuck if unlocking can\'t run.',
    type: 'fix',
    icon: ScrollText,
  },
  {
    date: '2026-10-31',
    title: 'Shorter Footer',
    description: 'The footer at the bottom of each page (Global Hotkeys, Help Page and Privacy Notice) takes up much less space: the extra empty room below it is gone and its lines sit closer together, centered on phones.',
    type: 'improvement',
    icon: ScrollText,
  },
  {
    date: '2026-10-31',
    title: 'Service Minutes on the Progress Report',
    description: 'The Progress Report has a Service minutes switch (off by default). Turned on, the report adds a Service Minutes section: the minutes the IEP requires, the minutes delivered in the reporting period, and for a weekly or monthly requirement the minutes expected for the period, the average per week or month and how far over or short it is (for a yearly requirement, the share of it delivered). Minutes come from the sessions\' start and end times; missed sessions aren\'t counted.',
    type: 'feature',
    icon: ScrollText,
  },
  {
    date: '2026-10-31',
    title: 'Merge Sessions Saved in Parts',
    description: 'On the Sessions page, tick the records of one session that was saved in parts (saved, then more data collected and saved again) and choose Merge Selected. They become one session that runs from the earliest start to the latest end, so service minutes count the time once. Counts and trials are added together, each task analysis step keeps its latest score, ratings keep the latest, and notes are joined. Only sessions of the same student on the same day can be merged; the window shows the merged time and minutes first.',
    type: 'feature',
    icon: GitMerge,
  },
  {
    date: '2026-10-31',
    title: 'Task Analysis Goal Type',
    description: 'A new goal type for multi-step skills (routines, self-care, device use). Add the steps to a student\'s task analysis goal in Students → Edit Assigned Goal → Task Steps, one per line. In Data Entry each step has buttons for Independent, the prompt levels (visual, verbal, gestural, partial physical, model) and Not done; the hotkeys score the next unscored step (C independent, N not done, D/V/G/P/F/I prompt levels). The measure is the percentage of steps done independently, so targets, aim lines, mastery, Reports (with a chart of each step), the narrative and the Progress Report all work with it. Three task analysis templates are included (handwashing, arrival routine, requesting with a communication device).',
    type: 'feature',
    icon: ListChecks,
  },
  {
    date: '2026-10-31',
    title: 'Student Groups for Data Entry',
    description: 'Save groups of students, such as a class or a small group, with Students → Groups (or Data Entry → Load Group → Manage Groups). In Data Entry, Load Group (on the Student button\'s line, next to the scroll arrows) fills the slots with that group\'s students in one tap. A student already in a slot with unsaved entries keeps their slot, so nothing entered is lost. Archived students are skipped. Groups are saved on this device.',
    type: 'feature',
    icon: UserPlus,
  },
  {
    date: '2026-10-31',
    title: 'Collapsible Hotkeys in the Footer',
    description: 'Tap Global Hotkeys at the bottom of any page to hide or show the list of keyboard shortcuts. The choice is remembered on this device; the Help and Privacy Notice links stay visible.',
    type: 'improvement',
    icon: KeyboardIcon,
  },
  {
    date: '2026-10-31',
    title: 'School Year Dates in Settings',
    description: 'Settings → Interface → School Year sets the first and last day of the school year (the month and day repeat each year). Student profiles use it for school-year attendance and service minutes, and the Progress Report for School year to date. It was August 1 to July 31 before.',
    type: 'feature',
    icon: BookOpen,
  },
  {
    date: '2026-10-31',
    title: 'Student Overview: IEP Dates, Service Minutes and Attendance',
    description: 'Each student profile has an Overview. IEP Dates shows the IEP date, the annual review and re-evaluation due dates, and how many days are left (amber within 30 days, red when overdue). Service Minutes shows the minutes delivered this and last week or month against what the IEP requires, and the school-year total, from each session\'s start and end times. Attendance shows the share of sessions attended this school year, sessions held and missed (with reasons), and the last session. Set the dates and required minutes (per week, month or school year) with Edit IEP Details.',
    type: 'feature',
    icon: UserSearch,
  },
  {
    date: '2026-10-31',
    title: 'Scroll Arrows in the Middle of the Bottom Bar',
    description: 'In Data Entry, the left and right arrows that scroll between students are now in the middle of the bottom bar, on the same line as the Student button, instead of under Student and Goal. On iPad in landscape the whole bar fits on one line.',
    type: 'improvement',
    icon: ArrowRightLeft,
  },
  {
    date: '2026-10-31',
    title: 'Missed Sessions and Attendance',
    description: 'Each Data Entry student card has a Missed button (calendar icon) to record a session that didn\'t take place on the date and times set, with the reason (student absent, student unavailable, provider absent, no school, or other) and an optional note. Missed sessions appear on the Sessions page, count toward attendance on Reports and the Progress Report (for example "12 held · 2 missed (Student absent 2)"), and are included in CSV exports with an Attendance column. They aren\'t counted in progress charts or figures.',
    type: 'feature',
    icon: UserX,
  },
  {
    date: '2026-10-31',
    title: 'Student Names in Goal Text',
    description: 'Goal statements now show the student\'s first name in place of "STUDENT" and "the student" (for example "By Oct 15, 2026, Ava will…"), on the Progress Report, the student profile, Data Entry and Edit Session. The saved goal text is unchanged, so goal templates stay general.',
    type: 'improvement',
    icon: Pencil,
  },
  {
    date: '2026-10-31',
    title: 'Baseline, Aim Line and Mastery Criteria',
    description: 'In Students → Edit Goal, a goal can have a baseline (where the student started) and a baseline date, and mastery criteria (the target met in a number of sessions in a row, 3 if not set). With a target and a target date, Reports and the Progress Report draw an aim line from the baseline to the target by the target date and show whether the student is On track or Behind the aim line (the last 3 sessions all short of it). A goal that meets its mastery criteria shows as Mastered on Reports and Goal met on the Progress Report, and the written comments describe progress against the aim line. A goal\'s target date now also fills in "[date]" in its goal text (for example "By Jun 12, 2027, …") on the Progress Report, the student profile and Data Entry.',
    type: 'feature',
    icon: ScrollText,
  },
  {
    date: '2026-10-31',
    title: 'Report Date and Goal Target Dates',
    description: 'The Progress Report has a Report date you can change (for example, to the IEP progress-reporting date). Each goal can have a target date, the date its criteria should be met by: set it on the Progress Report or in Students → Edit Goal. It is saved with the goal and printed with the target, for example "Target 80% by Jun 12, 2027". Settings → Interface → School or District Name puts your school or district at the top of the report in place of AscendEd.',
    type: 'feature',
    icon: ScrollText,
  },
  {
    date: '2026-10-31',
    title: 'Printable Progress Report',
    description: 'Reports → Progress Report makes a printable IEP goal progress report for a student and reporting period (last 30 days, a quarter, the school year or custom dates). It has a summary table of every goal, then for each goal its statement and target, sessions, average, range, latest result and how often the target was met, a progress rating (Goal met, Making progress, Limited progress, Not making progress, Too few sessions, Not addressed), a chart with the target line, and written comments from the data. Change the rating or comments before printing; print it or save it as a PDF. Like everything else, it is made on the device.',
    type: 'feature',
    icon: ScrollText,
  },
  {
    date: '2026-10-31',
    title: 'Start and End Time on One Line',
    description: 'In Data Entry, Reset Time to Now now sits beside the Session Date, so the Start Time and End Time share the next line on every screen size, phones included.',
    type: 'improvement',
    icon: LayoutGrid,
  },
  {
    date: '2026-10-31',
    title: 'Privacy Notice and Accessibility Fixes',
    description: 'A new Privacy Notice page (linked from Settings and the footer) explains what the app stores, where it is kept, who can see it and how to delete it. Accessibility (WCAG 2.1 AA): every page now has its own title and a main heading; dropdowns, the + and − counter buttons and number boxes in Data Entry have names that screen readers announce; progress bars report their value; the Independent prompt color and the Sessions table header have stronger contrast; a Skip to Main Content link appears on the first Tab press; and Settings → Interface can turn off Data Entry\'s single-key shortcuts (for speech input or switch users) while keeping the Alt and Ctrl/Cmd ones.',
    type: 'feature',
    icon: ShieldCheck,
  },
  {
    date: '2026-10-31',
    title: 'Scroll Arrows for Data Entry Students',
    description: 'Data Entry has left and right arrows under the Student and Goal buttons in the bottom bar. Each tap scrolls the student cards sideways by one card, lining the next card up with the left edge. An arrow is greyed out when there is nothing more to scroll in that direction.',
    type: 'feature',
    icon: ArrowRightLeft,
  },
  {
    date: '2026-10-31',
    title: 'More Than 5 Students in Data Entry',
    description: 'Data Entry no longer stops at 5 student slots: Add Student Slot is available until every active student is in a slot. An Add Student button next to Save Focused adds a slot from anywhere (it stays in view however many slots there are). Slots past the screen width scroll sideways, and the focused slot is brought into view (A and Alt+A cycle through all of them; the 1-4 keys still jump to the first four).',
    type: 'feature',
    icon: UserPlus,
  },
  {
    date: '2026-10-31',
    title: 'Menu Bar at the Bottom of the Screen',
    description: 'Settings → Interface → Menu Bar Position moves the menu bar to the bottom of the screen (above the home indicator), where it is easier to reach when holding a tablet, or back to the top. The account menu opens upward when the bar is at the bottom, and pop-up messages stay above it. The setting is saved on this device only.',
    type: 'feature',
    icon: PanelBottom,
  },
  {
    date: '2026-10-31',
    title: 'Password-Protected Backups, CSV Warning and Deleting Data',
    description: 'Back Up Now asks for a password and saves the backup encrypted with it (AES-256), so only someone with the password can restore it; restoring asks for the password. You can still save without a password after confirming you will keep the file somewhere secure. Exporting a CSV now warns first that the file holds student data in plain text. Settings → Delete Data adds an end-of-year clean-up (select students who have left, or all archived students in one tap, and delete them with all their sessions) and Delete All Data, which removes everything the app has stored on the device (type DELETE to confirm).',
    type: 'feature',
    icon: ShieldCheck,
  },
  {
    date: '2026-10-31',
    title: 'Passcode Protection (Encrypted Student Data)',
    description: 'Settings → Passcode Protection encrypts the student data stored on this device (students, sessions and unsaved Data Entry work) with a passcode of at least 6 characters, using AES-256. The app then opens to a lock screen, locks again after 5 to 60 minutes without use (your choice) or with the Lock button in the menu bar, and the data can only be read after the passcode is entered. The passcode can\'t be recovered: if it is forgotten, the student data on the device can only be erased and restored from a backup, so back up first. Goal templates and settings aren\'t student data and aren\'t encrypted; backup and CSV files aren\'t encrypted either.',
    type: 'feature',
    icon: Lock,
  },
  {
    date: '2026-10-31',
    title: 'Only the App\'s Own Scripts Can Run',
    description: 'Every page now tells the browser to run only the app\'s own code: its script files and the exact scripts built into each page. Any other script, such as one injected into the page or loaded from another website, is blocked. This protects student data on the device from code that isn\'t part of the app.',
    type: 'improvement',
    icon: ShieldCheck,
  },
  {
    date: '2026-10-31',
    title: 'AI Features Removed',
    description: 'The AI features (SMART goal generation, AI goal search, activity suggestions and AI summaries) and the AI libraries they used have been removed from the app entirely. They were already turned off in the website and Android app; now no AI code is included at all, so student data has no path to an AI service. Goal search on the Goals page searches the words in goal names, goal text and skill areas, and the progress narrative on the Reports page is written from your data on the device.',
    type: 'improvement',
    icon: ShieldCheck,
  },
  {
    date: '2026-10-30',
    title: 'Fixed: Third App Review',
    description: 'Data Entry: the session date and times now follow the current time unless you set them. When you start entering a new session, the date moves to today and the start time to now, so a page left open all day no longer saves every session at 8:00, and saving unsaved work restored from an earlier day no longer files the rest of the day under that day. A time you pick is kept until that session is saved; a past date you pick is kept until you change it or tap Reset Time to Now. Switching a student slot or removing it now asks before discarding that student\'s unsaved entries (they used to stay hidden and come back later). The Student Access Lock also covers Edit Student, the slot\'s student picker and Add Student Slot. In Edit Session, the trial buttons (Correct, Approx., Incorrect, Undo, Reset) no longer save and close the window after one tap, and a save that fails keeps your edits open. Independent on a full trial grid does nothing (it used to make removing it erase a real correct trial). CSV import keeps each session\'s ID (so a later backup merge doesn\'t add it twice), keeps two sessions at the same time as two sessions, adds goals the student doesn\'t have instead of hiding their data, and keeps text fields as text. Reports: latency sessions where the student never responded are included (they used to be left out); percentages in the narrative are shown to one decimal, matching the target check; Overall Accuracy shows — for goals that aren\'t trial-based, and accuracy charts only appear for trial goals; charts skip days the selected goals weren\'t worked on; sessions saved with the same date and time are in saved order everywhere; the profile shows targets in the right unit; no "lower the target" advice when it is already 0. Menus and pop-ups open next to their buttons in Chrome and the Android app. On iPhone, the menu, notifications and header stay clear of the status bar and notch.',
    type: 'fix',
    icon: Bug,
  },
  {
    date: '2026-10-30',
    title: 'Fixed: Second App Review',
    description: 'Data Entry: unsaved work restored from another day keeps its date (it no longer moves to today); Save All and Save Focused skip students with nothing entered, so no empty sessions; tapping a goal no longer scrolls the card away; the Student Access Lock also locks the date, times, Reset Focused and removing students. On phones, the Save buttons fit on screen and the menu closes after choosing a page and scrolls to Settings and Help in landscape. The student sidebar fills the height below the header on tablets. Restoring a backup (Replace) now works when saved data was damaged. CSV import matches students and goals by name when the file came from another device, and skips sessions for students not on this device; the student profile export includes every column; imported sessions can be edited. Built-in goals you renamed no longer come back as duplicates. Reports: sessions on the same day are ordered by start time everywhere; "met target" is the same on the goal card and in the narrative; suggested next steps for decrease goals say "lowering" and "above"; cognitive targets show "4 out of 5"; observation goals with a target show their progress in the sidebar; switching students resets the goal filter; a timer left running in Edit Session no longer keeps counting; removed goals no longer count in overall accuracy; a tie no longer names a busiest day. Also: removing an Independent prompt takes back its correct response; taking back a dysfluency lowers total syllables; Edit Student asks before removing a goal; pinch-zoom works on Android tablets; old app files are cleared after updates; the Android app can be built as a release build.',
    type: 'fix',
    icon: Bug,
  },
  {
    date: '2026-10-30',
    title: 'Student Access Lock Needs a PIN',
    description: 'Turning off the Student Access Lock on Data Entry now asks for a PIN, chosen the first time you turn the lock on (4 to 8 digits, kept only on this device). The L hotkey works the same way. If the PIN is forgotten, Forgot PIN? unlocks only by discarding the unsaved entries on Data Entry, and you choose a new PIN next time.',
    type: 'improvement',
    icon: Lock,
  },
  {
    date: '2026-10-30',
    title: 'Fixed: Data Safety and Report Accuracy',
    description: 'Save All now saves every student\'s session (some could be lost when saving several at once). If the device\'s storage is full, saving says so instead of failing silently, and restoring a backup changes nothing unless all of it fits. Editing a session no longer moves its date back a day. Data Entry moves to today\'s date when the app is reopened on a later day with nothing entered (a past date you chose is kept), and keeps up with goals edited while it is open. Sequenced Trials are scored from the trial boxes, and their C/N/B hotkeys fill the next box. Behavior goals not worked on in a session are no longer charted as 0. Fluency % counts blocks, repetitions and interjections, the same as Data Entry. Report dates stay in order across years, and days with no trial data are gaps instead of 0%. CSV export includes every goal type\'s columns, and importing it keeps prompt levels and skips sessions already on the device. Merging a backup adds goals that only the backup has to students already on the device. Built-in goals you renamed stay renamed after updates. Also: the Independent button records a correct response (like the I hotkey); clearing Number of Trials no longer erases trials; student edit buttons show on touch screens; the narrative window scrolls on small screens; the Android app no longer copies student data to cloud backups; and the web app can\'t be shown inside another site.',
    type: 'fix',
    icon: Bug,
  },
  {
    date: '2026-10-30',
    title: 'Better Progress Narratives',
    description: 'Write Narrative now starts with an overview of where every goal stands (target met several sessions in a row, improving, steady, moving away from the target, too few sessions, no data). Trends use every session (a line fitted through all of them) instead of comparing the first and second half, and it says when the target was met in the last sessions in a row. Duration, interval and latency goals get their own details (episodes and longest episode, intervals scored, median time to respond and no-response trials). Choose Detailed (a paragraph per goal) or Brief (one line per goal), and turn on Suggested next steps for a data-based suggestion per goal, such as raising a target that was met 3 sessions in a row.',
    type: 'improvement',
    icon: ScrollText,
  },
  {
    date: '2026-10-30',
    title: 'Fixed: Time Picker on Phones in Landscape',
    description: 'Start and End Time (Data Entry and Edit Session) now use the app\'s own time picker instead of the phone\'s clock pop-up, which on Android in landscape was cut off below its Set button. Tap the time, choose the hour, the minute (in 5-minute steps, or −/+ for a single minute) and AM/PM, then Done; Now sets the current time.',
    type: 'fix',
    icon: Bug,
  },
  {
    date: '2026-10-30',
    title: 'Behavior Reports: When It Happens',
    description: 'Data Entry now records the time of each behavior occurrence (each Count tap, each duration episode start, each latency trial, and when interval recording starts; ABC incidents already had times). Each behavior goal on the Reports page has a new "When it happens" section: time of day, day of week (average per session), and minutes into the session, with the peak time; a per-session trend that fits the goal (rate per hour, average episode length, or trials with no response); and an occurrence log with the date and time of everything recorded. Sessions saved before times were recorded use the session\'s start time (marked ~). The written narrative also says when the behavior happens most.',
    type: 'feature',
    icon: BarChartHorizontalBig,
  },
  {
    date: '2026-10-29',
    title: 'Fixed: Hazy Top Bar (New Layout)',
    description: 'The app now fills the screen exactly, with the top bar as a fixed part of the layout and only the page below it scrolling, instead of a bar pinned over a scrolling page. On iPad, the pinned bar could stay dimmed after a pop-up window or goal pop-up closed until the app was reloaded. The footer now scrolls with the page, and each page opens scrolled to the top.',
    type: 'fix',
    icon: Bug,
  },
  {
    date: '2026-10-29',
    title: 'Goal Library Cleanup',
    description: '10 built-in goals that repeated another built-in goal word for word in meaning (e.g. "Identify the opposite" and "Identify antonyms", three versions of "Follow 2-step directions") are archived once on each device and no longer added; they can be restored with Show Archived, and students who already have one keep it. In Find Duplicates you can now keep more than one goal in a group: tick each goal to keep and archive the rest; goals kept together are not shown as duplicates again. Shortened goal names ("…") are only matched by their full goal text, so goals that differ after the cut-off are no longer flagged.',
    type: 'improvement',
    icon: ListChecks,
  },
  {
    date: '2026-10-29',
    title: 'Clean Up and Find Goals Faster',
    description: 'Goals page: Find Duplicates lists goals with the same or nearly the same wording side by side; pick the one to keep and archive the rest (archived goals are hidden from goal lists and can be restored; students who already have one keep it), or mark a group as not duplicates. Each goal card also has an Assign to Students button to give that goal to one or more students at once. In Edit Student and Assign Goals, the goal list now has Skill Area as well as Type filters, searches the full goal text, hides archived goals, and lists the goals you assigned most recently first.',
    type: 'feature',
    icon: ListChecks,
  },
  {
    date: '2026-10-29',
    title: 'Read the Full Goal',
    description: 'Many goal bank goals have shortened names that end in "…". Tap a goal\'s name (dotted underline) on a Data Entry card, or in Edit Student\'s goal lists, to read the whole goal; in Assign Goals, tap the ⓘ button next to a template.',
    type: 'improvement',
    icon: BookOpen,
  },
  {
    date: '2026-10-29',
    title: 'Articulation Goals Use IPA',
    description: 'Articulation goal templates now name their target sounds in the International Phonetic Alphabet, with the familiar spelling as a hint where the symbol is not a plain letter, e.g. /ʃ/ ("sh"), /θ/ (voiceless "th"), /ɹ/ ("r"), /tʃ/ ("ch"). Templates were added so every English consonant has goals for each word position it occurs in (initial, medial, final). Existing articulation templates and goals already assigned to students are renamed on each device; descriptions you edited are kept.',
    type: 'improvement',
    icon: ListPlus,
  },
  {
    date: '2026-10-28',
    title: 'Fixed: Hazy Top Bar After Closing a Window',
    description: 'On iPad, the top bar could stay dimmed after a pop-up window such as Edit Student was closed (for example after adding a goal from Data Entry), until the app was reloaded. The dimmed background behind pop-up windows now disappears at once instead of fading, and the whole screen is redrawn when a pop-up window closes.',
    type: 'fix',
    icon: Bug,
  },
  {
    date: '2026-10-28',
    title: 'Fixed: Goal Names Cut Off When Assigning Goals',
    description: 'In Edit Student and Assign Goal, long goal names ran past the edge of the goal lists. They now wrap onto more lines so the whole name can be read.',
    type: 'fix',
    icon: Bug,
  },
  {
    date: '2026-10-28',
    title: 'Larger + and - Buttons in Data Entry',
    description: 'The + and - buttons on the Data Entry goal cards are larger (36px instead of 28px) so they are easier to tap on a tablet, and the number boxes next to them match their height.',
    type: 'improvement',
    icon: PlusCircle,
  },
  {
    date: '2026-10-28',
    title: 'Write Narrative on Reports',
    description: 'Reports has a Write Narrative button that writes a progress summary of the data in view (student, goal and date range) for each goal: sessions with data, average and range, the most recent result against the target, how often the target was met, the trend over the period, and details that fit the goal type (responses and prompting, story parts, communication functions, dysfluencies, behavior rate, ABC patterns) plus recent notes. It is built from the data with fixed sentence patterns, can be edited, and can be copied or saved as a text file.',
    type: 'feature',
    icon: ScrollText,
  },
  {
    date: '2026-10-28',
    title: 'Fixed: Data Entry Hotkeys',
    description: 'The data hotkeys (C, N, B, prompt keys D/V/G/P/F/I, and fluency B/R/H/J) erased the focused goal\'s data instead of adding to it; they now add one each press, even in quick succession. Alt (Option) shortcuts now work on Mac and iPad keyboards, Cmd+Enter saves like Ctrl+Enter, and Cmd/Ctrl+C no longer counts a correct response. On Discrete Trials goals C, N and B mark the next trial correct, incorrect or approximate, and on Behavior Frequency goals C adds an occurrence. Hotkeys follow each goal\'s data collection type and pause while a window is open.',
    type: 'fix',
    icon: KeyboardIcon,
  },
  {
    date: '2026-10-28',
    title: 'Fixed: Reports Missing Some Goals\' Data',
    description: 'Goals entered with a different data collection type than their goal type (for example a language goal recorded as discrete trials) now show their data in Reports and the sidebar; they were being read as their goal type, so their sessions looked empty. Data Entry now also marks each goal you work on, so a rating left at 3 still counts as recorded.',
    type: 'fix',
    icon: Bug,
  },
  {
    date: '2026-10-28',
    title: 'Fixed: Editing Sessions (More Cases), Update Notice, Error Details',
    description: 'Editing a saved session also works for sessions with an unreadable date or without their original goal list (e.g. imported), and the edit window no longer reloads itself while open. When a new version is downloaded, a notice offers to reload into it. If a page ever fails, it now shows what went wrong (with the app version) and a Try Again button instead of a blank screen. Settings shows the app version. Notices no longer appear twice. In the sidebar goal progress, goal names wrap instead of being cut off, articulation and language goals show their real progress (they showed 0%), progress uses the latest session where the goal was actually worked on, and goals turn green when their target is met.',
    type: 'fix',
    icon: Bug,
  },
  {
    date: '2026-10-28',
    title: 'Fixed: Editing Sessions and Report Totals',
    description: 'Editing a saved session no longer shows "Application error". Reports\' Total Opportunities, Total Correct, Total Incorrect and accuracy now count only correct, incorrect and approximate responses from trial-based goals; Story Champs points, fluency syllables and communication function uses were being added as opportunities and errors (including for goals not worked on in a session). Those goals are reported on their own Goal by Goal cards.',
    type: 'fix',
    icon: Bug,
  },
  {
    date: '2026-10-28',
    title: 'Reset Time to Now',
    description: 'Data Entry has a Reset Time to Now button next to the session times. It sets the date to today, the start time to now and the end time to 30 minutes later, for starting the next session after a break.',
    type: 'improvement',
    icon: RotateCcw,
  },
  {
    date: '2026-10-28',
    title: 'Data Entry Keeps Unsaved Work',
    description: 'Data Entry now keeps what you have entered when you switch to another page and come back, and even if the app is closed or reloaded: the selected students, counts, timers (which keep running), notes, activity, date and times, and the student access lock. Each student\'s unsaved data is cleared when their session is saved or reset. If the app reopens with unsaved data, a notice says it was restored. New sessions now default to 30 minutes long (end time 30 minutes after the start), and the default start and end times now show in the time fields. Student cards now fill the screen height down to the save buttons, and grow taller when the date and time card is collapsed; their contents no longer get cut off on the right with larger text.',
    type: 'improvement',
    icon: Pencil,
  },
  {
    date: '2026-10-28',
    title: 'Reports: Goal by Goal',
    description: 'Reports now include a card for every goal, charted by the measure that fits its type (accuracy, % fluent, Story Champs score, communication functions used spontaneously, 1-5 rating, % independent, or the behavior measures) with the target line, sessions with data, latest, average and how many sessions met the target. Each card also breaks the data down for its goal type: correct/approximate/incorrect responses per session, prompt levels, story part scores and linking words, uses by communication function, dysfluency types, or ABC antecedents and functions, plus recent notes. Sessions where nothing was recorded for a goal are no longer charted as 0.',
    type: 'feature',
    icon: BarChartHorizontalBig,
  },
  {
    date: '2026-10-28',
    title: 'Behavior Data: Interval, Latency, Reports and ABC Lists',
    description: 'Two more behavior goal types. Interval recording (partial interval, whole interval or momentary time sampling) marks each interval + or −, with an interval timer that can beep at each interval, and reports the % of intervals with the behavior. Latency times from a cue to the response and reports the average. The ABC antecedent, behavior and consequence lists can be edited in Settings and are included in backups. Includes 6 new behavior templates.',
    type: 'feature',
    icon: BarChartHorizontalBig,
  },
  {
    date: '2026-10-28',
    title: 'Behavior Data: Frequency, Duration and ABC',
    description: 'Three new goal types for behavior data. Frequency counts occurrences (with a rate per hour when you enter the observation time). Duration times episodes with a start/stop timer or entered by hand. ABC data records incidents as antecedent, behavior and consequence, and shows the most common antecedents and likely functions. Behavior goals can aim to decrease or increase. Includes 13 behavior templates, and 25 goal bank goals (including Behavior Replacement & Regulation) now use these types.',
    type: 'feature',
    icon: ListChecks,
  },
  {
    date: '2026-10-28',
    title: 'SLP Goal Bank: 903 New Goal Templates',
    description: 'Added 903 goal templates from the SLP goal bank across 50 skill areas, each set up with the data collection type and session target that fit how the goal is measured. The Goals page can now filter by skill area, and the info button on a goal shows its purpose, activity ideas and tags. Searching templates now also matches the goal text.',
    type: 'feature',
    icon: ListPlus,
  },
  {
    date: '2026-10-28',
    title: 'Display Size Setting',
    description: 'Settings now has a Display Size option (100%, 90%, 80%, 70%) that zooms the whole app out to fit more on screen. Tablets such as iPads start at 80%. Tapping a text box no longer zooms the page in on iPad.',
    type: 'improvement',
    icon: Minimize2,
  },
  {
    date: '2026-10-28',
    title: 'Communication Functions Goal Type',
    description: 'A new goal type for tallying communicative functions (requesting, commenting, protesting, greeting, gaining attention, answering and asking questions, expressing feelings, directing others) as spontaneous or prompted. Progress is the number of different functions used spontaneously. Includes nine default goal templates; the GLP "variety of communicative functions" template now uses this type.',
    type: 'feature',
    icon: MessagesSquare,
  },
  {
    date: '2026-10-28',
    title: 'Story Champs Goal Type',
    description: 'A new goal type for Story Champs narrative data: score Character, Setting, Problem, Feeling, Action, Ending and End Feeling as 0 (missing), 1 (partial) or 2 (complete), and tally linking words. The story score is the percentage of 14 possible points. Includes eight default goal templates; "Retell a short story with 3 key elements" now uses this type.',
    type: 'feature',
    icon: BookOpen,
  },
  {
    date: '2026-10-28',
    title: 'Backup & Restore',
    description: 'Back up all students, goals, templates and sessions to a file from the Settings page, and restore it on the same or another device. Restoring can add to the data already on the device or replace it. The dashboard reminds you when there is no backup from the last 7 days.',
    type: 'feature',
    icon: DatabaseZap,
  },
  {
    date: '2026-10-27',
    title: 'Firebase Removed',
    description: 'Firebase has been removed from the application. All data is now stored in your browser on this device. Email sign-in and sign-up, and the Firebase setting on the Settings page, have been removed.',
    type: 'improvement',
    icon: DatabaseZap,
  },
  {
    date: '2025-10-18',
    title: 'Student Deletion',
    description: 'You can now permanently delete a student and all their associated session data. A confirmation dialog has been added to prevent accidental deletion. This feature is accessible from the Student Profile page.',
    type: 'feature',
    icon: UserX,
  },
  {
    date: '2025-10-18',
    title: 'Enhanced Student Filtering & Sorting',
    description: 'The Students page now includes powerful search, sort, and filter capabilities, similar to the Goal Templates page. You can now search by name and sort by name, date joined, or last updated.',
    type: 'improvement',
    icon: UserSearch,
  },
  {
    date: '2025-10-18',
    title: 'Back Button on Student Profile',
    description: 'Added a back arrow button to the Student Profile page header, allowing for easy navigation back to the main student selection grid.',
    type: 'improvement',
    icon: ArrowLeft,
  },
  {
    date: '2025-10-18',
    title: 'Sidebar Display Setting',
    description: 'Added a new toggle on the Settings page to enable or disable the student sidebar. This allows users to maximize their screen space when desired.',
    type: 'feature',
    icon: PanelLeft,
  },
  {
    date: '2025-10-17',
    title: 'Goal Template Search Refactor',
    description: "Refactored the goal template search and filter functionality for improved performance and maintainability. Encapsulated the logic into a new reusable hook (`useGoalTemplateSearch`). This change also resolves a bug where the standard search filter was not working as expected.",
    type: 'improvement',
    icon: GitMerge,
  },
  {
    date: '2025-10-17',
    title: 'Enhanced Goal & Session Management',
    description: "Improved workflow with several new features. Added a 'Cognitive' goal type for tracking skills like attention and memory, complete with default templates. The Goal Templates page now allows deleting custom templates and archiving/unarchiving default templates. The Data Entry page now includes a 'Save All' button to save data for all active students at once. The 'Edit Student' modal has also been widened for better usability.",
    type: 'feature',
    icon: BrainCircuit,
  },
    {
    date: '2025-10-17',
    title: 'Data Entry UI & Controls Refinement',
    description: "Improved the layout and user experience on the Data Entry page. The 'Select Student' and 'Select Goal' buttons are now integrated into the bottom action bar on mobile devices for easier access, while remaining as a floating control on desktop for a cleaner workspace. Also adjusted student card height for better visibility.",
    type: 'improvement',
    icon: LayoutGrid,
  },
  {
    date: '2025-10-15',
    title: 'Data Import & Export',
    description: 'Added the ability to export and import student session data as a readable CSV file. This feature is available on both the Analysis Report and the individual Student Profile pages.',
    type: 'feature',
    icon: Upload,
  },
  {
    date: '2025-10-15',
    title: 'Student Archiving',
    description: 'You can now archive students instead of permanently deleting them. Archived students are hidden from active lists by default but their data is preserved. Use the toggle on the Students page to view them.',
    type: 'feature',
    icon: UserX,
  },
   {
    date: '2025-10-15',
    title: 'Navigation & Hotkey Updates',
    description: 'Reordered the main navigation to place "Data Entry" directly after "Dashboard" for quicker access. All associated navigation hotkeys (Alt+1 through Alt+5) have been updated to match the new order.',
    type: 'improvement',
    icon: ArrowRightLeft,
  },
  {
    date: '2025-10-15',
    title: 'Dashboard & Data Entry UI Enhancements',
    description: 'The Dashboard\'s "Quick Actions" have been moved to the top and their card size reduced for a more compact layout. On the Data Entry page, the layout for Correct/Incorrect/Approximate counters has been adjusted for better alignment and readability.',
    type: 'improvement',
    icon: LayoutGrid,
  },
    {
    date: '2025-10-14',
    title: 'UI and Layout Enhancements',
    description: 'Improved the main application layout by making the student sidebar resizable. Enhanced the top header by centering the main navigation for a more balanced look. Fixed several text overflow and wrapping issues in the sidebar to ensure content remains visible. Adjusted component alignment and spacing for a more polished UI.',
    type: 'improvement',
    icon: LayoutGrid,
  },
    {
    date: '2025-10-14',
    title: 'Improved Student Selection & UI Refactor',
    description: 'Replaced the automatic redirect on the Student Profile page with a dedicated student selection grid for a more intuitive user experience. Refactored the Data Entry header card to use cleaner, more modular components.',
    type: 'improvement',
    icon: UserSearch,
  },
    {
    date: '2025-08-10',
    title: 'UI and Layout Enhancements',
    description: 'Improved the main application layout by making the student sidebar resizable. Enhanced the top header by centering the main navigation for a more balanced look. Fixed several text overflow and wrapping issues in the sidebar to ensure content remains visible. Adjusted component alignment and spacing for a more polished UI.',
    type: 'improvement',
    icon: LayoutGrid,
  },
    {
    date: '2025-08-09',
    title: 'UI & Data Entry Enhancements',
    description: 'Improved the "Edit Session" modal to ensure all content is fully scrollable, preventing fields from being cut off on smaller screens. The "Number of Trials" input on the Data Entry page can now be cleared, making it easier to input new values without needing to delete the previous one.',
    type: 'improvement',
    icon: GitMerge,
  },
    {
    date: '2025-08-08',
    title: 'UI & Data Entry Enhancements',
    description: "Improved the user interface by making the side navigation menus scrollable on smaller screens, preventing layout issues. Enhanced data entry by adding an 'End Time' for sessions and including an 'Approximate' response counter.",
    type: 'improvement',
    icon: GitMerge,
  },
    {
    date: '2025-07-19',
    title: 'Expanded Goal Template Library to 75',
    description: "The default goal template library has been significantly expanded to 75 unique templates. This includes a much wider range of articulation goals covering initial, medial, and final word positions for key phonemes.",
    type: 'feature',
    icon: ListPlus,
  },
  {
    date: '2025-07-19',
    title: 'Robust Data Seeding for Goal Templates',
    description: "Corrected the data seeding logic to ensure the full set of 75 default goal templates are always available upon first use or after an update. This resolves issues where the goal template count appeared incorrect.",
    type: 'improvement',
    icon: DatabaseZap,
  },
   {
    date: '2025-07-19',
    title: 'Updated Prompting Terminology to "Imitation"',
    description: 'Based on clinical feedback, the "Full Physical" prompt type has been updated to "Imitation" throughout the application for better clarity and alignment with standard practices.',
    type: 'improvement',
    icon: ArrowRightLeft,
  },
  {
    date: '2025-07-19',
    title: 'Build & Runtime Stability Fixes',
    description: "Addressed multiple build-time and runtime errors to improve application stability. This includes fixing syntax errors, resolving date formatting issues on the dashboard and goal templates pages, and updating the student profile page to prevent Next.js parameter handling warnings.",
    type: 'fix',
    icon: Bug,
  },
    {
    date: '2025-07-13',
    title: 'Expanded & Diversified Goal Template Library',
    description: "The default goal template library has been significantly expanded to 75 unique templates. This includes new, dedicated goals for Gestalt Language Processors (GLP) and a wider range of communicative functions, providing more comprehensive and neurodiversity-affirming starting points.",
    type: 'feature',
    icon: ListPlus,
  },
  {
    date: '2025-07-13',
    title: 'Robust Data Seeding & Syncing',
    description: "Corrected the data seeding logic to ensure the full set of 75 default goal templates are always available upon first use or after an update. This resolves issues where the goal template count appeared incorrect.",
    type: 'improvement',
    icon: DatabaseZap,
  },
   {
    date: '2025-07-13',
    title: 'Restored "Correct/Incorrect" Data Entry',
    description: 'Based on user feedback, the data entry flow for quantitative goals has been reverted to a direct "Correct" and "Incorrect" count system, replacing the "Opportunities" field for a more streamlined workflow.',
    type: 'improvement',
    icon: ArrowRightLeft,
  },
  {
    date: '2025-07-13',
    title: 'Build & Runtime Stability Fixes',
    description: "Addressed multiple build-time and runtime errors to improve application stability. This includes fixing syntax errors in constants files, resolving an issue with date formatting on the dashboard, and updating the student profile page to prevent Next.js parameter handling warnings.",
    type: 'fix',
    icon: Bug,
  },
    {
    date: '2025-06-30',
    title: 'New User Sign-Up Flow',
    description: "Added a dedicated sign-up page, allowing new users to create an account with a display name, email, and password. The login page has been updated to link to the new sign-up flow for a smoother onboarding experience.",
    type: 'feature',
    icon: UserPlus,
  },
  {
    date: '2025-06-30',
    title: 'New "Prompting" Goal Type for Focused Tracking',
    description: `Introduced a new "Prompting" goal type designed specifically to track the level of assistance a student needs for a task. This goal type simplifies data entry by focusing only on prompt counters and notes, helping to better measure a student's growing independence.`,
    type: 'feature',
    icon: PlusCircle,
  },
  {
    date: '2025-06-30',
    title: 'Build Stability and Minor Fixes',
    description: "Addressed several build-time errors, including an unterminated string constant in the analysis charts and a JSX parsing issue on the login page, enhancing overall application stability.",
    type: 'fix',
    icon: Bug,
  },
  {
    date: '2025-06-29',
    title: 'Dashboard Activity Feed is Now Live',
    description: "The 'Recent Activity' feed on the Dashboard is now fully dynamic. It automatically updates in real-time to show the 5 most recent actions, such as adding students, creating goal templates, and saving sessions.",
    type: 'feature',
    icon: Zap,
  },
  {
    date: '2025-06-29',
    title: 'Improved Data Entry Workflow and Persistence',
    description: "Data Entry is now more intuitive and reliable. Saving a session now correctly saves only the focused student. The student cycling hotkey ('A') now only cycles through active student slots. Additionally, all in-progress data on this page is automatically saved to your browser and restored on your next visit, preventing data loss.",
    type: 'improvement',
    icon: GitMerge,
  },
    {
    date: '2025-06-29',
    title: 'Hotkey Support for Sequenced Trials',
    description: "Added hotkey support to the 'Sequenced Trials' goal type for faster data input. You can now use 'C' to increment successful attempts and 'N' to increment failed attempts.",
    type: 'hotkey',
    icon: KeyboardIcon,
  },
  {
    date: '2025-06-29',
    title: 'Bug Fixes for Stability and UI',
    description: "Resolved several issues: fixed a server startup conflict between Webpack and Turbopack; corrected a scrolling bug in the 'View Session Details' modal; and fixed an issue where deleted students could cause issues with the student cycling hotkey on the Data Entry page.",
    type: 'fix',
    icon: Bug,
  },
  {
    date: '2025-06-28',
    title: 'Enhanced Qualitative Observation Goals',
    description: 'The "Qualitative Observation" goal type has been enhanced to include prompt level tracking. You can now record prompt counts directly on qualitative goals, alongside notes and ratings, making it a more versatile data collection tool.',
    type: 'improvement',
    icon: ListChecks,
  },
  {
    date: '2025-06-28',
    title: 'Data Entry Selection Buttons',
    description: 'Added dedicated buttons on the Data Entry page to open a selection modal for focused students and goals. This feature is available on both desktop and mobile for easier navigation without relying on hotkeys.',
    type: 'improvement',
    icon: ListChecks,
  },
  {
    date: '2025-06-28',
    title: 'Added Feeding/Swallowing Goal Type',
    description: 'Introduced a new "Feeding/Swallowing" goal type to track food textures, consistencies, and trials accepted/refused. This includes new data entry fields, hotkey support, and integration into analysis reports.',
    type: 'feature',
    icon: PlusCircle,
  },
  {
    date: '2025-06-28',
    title: 'Improved Application Load Performance',
    description: 'Significantly improved initial page load and navigation speed by optimizing the data loading strategy. Essential data (students, templates) is now prioritized, while larger session histories load in the background, making the app interactive much faster.',
    type: 'improvement',
    icon: Zap,
  },
  {
    date: '2025-06-28',
    title: 'Server Stability and UI Fixes',
    description: 'Resolved several issues causing server instability and restart loops due to rendering errors. Fixed a bug where the "Edit Student" modal content would not scroll correctly. Corrected invalid "class" props to "className" in JSX to prevent console errors.',
    type: 'fix',
    icon: Bug,
  },
  {
    date: '2025-06-28',
    title: 'Data Entry Hotkey Updates',
    description: 'Updated data entry hotkeys for prompt levels. "D" now increments Visual prompts, and "V" increments Verbal prompts, to align with the latest UI and provide more consistent shortcuts.',
    type: 'hotkey',
    icon: KeyboardIcon,
  },
  {
    date: '2025-06-18',
    title: 'Analysis Report: Goal Performance Flow (Sankey Diagram)',
    description: 'Added a new Sankey diagram to the Analysis Report page. This chart visualizes the flow of opportunities from Goal Type to Specific Goal, and then to Correct/Incorrect outcomes, offering a new perspective on performance distribution.',
    type: 'feature',
    icon: Workflow,
  },
  {
    date: '2025-06-18',
    title: 'Analysis Report: Enhanced Scatter Plot',
    description: "The scatter plot on the Analysis Report page now visualizes the relationship between 'Total Correct Responses' and 'Total Prompts Used (excluding Independent)' per session, providing insights into prompting effectiveness.",
    type: 'improvement',
    icon: Shuffle,
  },
  {
    date: '2025-06-18',
    title: "Data Entry: Streamlined 'Independent' Prompt",
    description: "The 'Independent' prompt counter on the Data Entry page now automatically increments (and decrements) the main 'Correct' count for the relevant goal type. This simplifies logging of unprompted correct responses.",
    type: 'improvement',
    icon: CheckSquare,
  },
  {
    date: '2025-06-18',
    title: 'Data Entry: Simplified Language Comprehension Input',
    description: "Removed the 'Questions Attempted' field for Language Comprehension goals on the Data Entry page to streamline input. Accuracy is now calculated based on Correct and Incorrect responses.",
    type: 'improvement',
    icon: Minimize2,
  },
  {
    date: '2025-06-18',
    title: 'Analysis Report: Graphing & Data Accuracy Fixes',
    description: 'Resolved issues in the Analysis Report page where graphs might not update correctly and X-axis date labels could duplicate. Data aggregation and chart rendering are now more robust.',
    type: 'fix',
    icon: Bug,
  },
  {
    date: '2025-06-18',
    title: 'Edit Session Modal: DatePicker Visibility Fix',
    description: 'Addressed an issue where the DatePicker calendar might not appear correctly within the Edit Session modal due to stacking order.',
    type: 'fix',
    icon: Bug,
  },
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

const changelogEntries = allChangelogEntries;

export default function ChangelogPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ScrollText className="h-10 w-10 text-primary" />
            <div>
              <CardTitle role="heading" aria-level={1} className="text-3xl font-bold">Application Changelog</CardTitle>
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

    

    

    


