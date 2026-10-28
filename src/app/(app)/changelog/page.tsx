
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { RotateCcw, ScrollText, GitMerge, Zap, Bug, PlusCircle, Pencil, ArrowUpDown, BarChartHorizontalBig, KeyboardIcon, Smartphone, Trash2, LayoutGrid, Minimize2, UserX, UserPlus, ArrowRightLeft, Lightbulb, Download, ListPlus, Workflow, Shuffle, CheckSquare, ListChecks, DatabaseZap, UserSearch, Upload, Sparkles, BrainCircuit, PanelLeft, ArrowLeft, MessagesSquare, BookOpen } from 'lucide-react';
import { APP_NAME } from '@/lib/appConstants';
import { AI_ENABLED } from '@/lib/features';

interface ChangelogEntry {
  version?: string; // Optional version number
  date: string;
  title: string;
  description: string;
  type: 'feature' | 'improvement' | 'fix' | 'hotkey';
  icon: React.ElementType;
  aiFeature?: boolean; // Only listed in builds with AI features turned on
}

const allChangelogEntries: ChangelogEntry[] = [
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
    date: '2025-10-17',
    title: 'AI-Powered Semantic Search for Goals',
    aiFeature: true,
    description: 'The Goal Templates page now features an AI-powered semantic search. Simply type your query and press Enter to find the most relevant goals based on meaning, not just keywords. Each result is ranked with a relevance score, and you can even generate a new goal template directly from your search query if you don\'t find what you\'re looking for.',
    type: 'feature',
    icon: Sparkles,
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
    title: 'AI Technical Summary Prompt Enhancement',
    aiFeature: true,
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

const changelogEntries = allChangelogEntries.filter(entry => AI_ENABLED || !entry.aiFeature);

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

    

    

    


