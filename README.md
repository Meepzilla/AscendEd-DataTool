# AscendEd

AscendEd is a data collection and progress reporting app for speech-language pathologists, special educators and related service providers. It records session data on IEP goals, tracks service minutes and attendance, and turns the data into charts, written narratives and printable progress reports.

It runs entirely on the device: there is no account, no server and no AI. Student data stays in the browser or Home Screen app and is never sent anywhere. It works offline once installed.

**Live app:** https://ascended-datatool.devinllewis-git.workers.dev

## Features

**Dashboard**
- Today's Work: a button per saved group that opens Data Entry with that group loaded, and a reminder when Data Entry has unsaved entries.
- Due Soon: IEP annual reviews and re-evaluations that are overdue or due within 60 days.
- Service Minutes: students who still need minutes this week or month (those short last time first), or are behind pace for a yearly requirement. Shows 4 at a time and scrolls.

**Data collection**
- Record several students at once, with no limit on slots. Saved groups (a class or small group) load in one step, and Remove All clears the slots (after asking, and naming anyone with unsaved data).
- 20 goal types, each with its own controls and measure, including:
  - accuracy counts and trial grids;
  - prompt levels, fluency, communication functions, story elements and task analysis;
  - behavior frequency, duration, ABC, interval and latency.
- Keyboard shortcuts for fast entry. Unsaved work survives switching pages or closing the app.
- Missed sessions are recorded with a reason. Sessions saved in parts can be merged so their minutes count once. Saved sessions can be edited, date and times included.

**Students and goals**
- A goal bank of over 900 templates, searchable by skill area, with purpose and activity ideas.
- Every built-in goal reads the same way: "By [date], the student will … with 80% accuracy across 3 consecutive sessions, as measured by …".
- Each goal has a target, a direction (increase or decrease), a target date, a baseline and mastery criteria. The goal text follows them: "[date]", the student's name, blanks ("___"), the stated percentage and the consecutive sessions are filled in from the goal's settings, in goal bank and custom goals alike. The number of opportunities ("4 out of 5 opportunities") stays as written unless it is the goal's only target.
- Each student's profile shows IEP dates, service minutes against the IEP (per week, month or school year) and attendance, with a View Report button for that student's charts and Progress Report.

**Reports**
- A chart per goal, with the target line and the aim line.
- Written progress narratives in brief or detailed style.
- A printable IEP progress report, with optional service minutes and your school or district name at the top.
- CSV export.

**Privacy and safety**
- Optional passcode protection: student data is encrypted on the device (AES-256).
- Backups to a file, optionally password-protected; restoring can merge or replace.
- A Student Access Lock with a PIN.
- A strict Content Security Policy: only the app's own scripts can run.
- A [Privacy Notice](src/app/(app)/privacy/page.tsx) page in the app.

The menu bar can sit at the top or the bottom of the screen (Settings → Interface); at the bottom it stays in reach while scrolling and sits above the footer.

In the app, the **Help** page (Alt + H) explains each feature, and the **Changelog** lists what changed.

## Tech stack

- [Next.js 15](https://nextjs.org/) (App Router) with a static export, plus [React 18](https://react.dev/) and [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) and Radix UI
- [Recharts](https://recharts.org/) for charts
- Browser `localStorage` for data, with Web Crypto for passcode encryption
- A service worker for offline use, and [Capacitor](https://capacitorjs.com/) for the Android app

## Development

Requires Node.js 22 (see `.nvmrc`).

```bash
npm install
npm run dev            # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build:static` | Offline static build in `out/`, used for hosting and Android. It adds the Content Security Policy (`scripts/add-csp.mjs`) and generates the service worker (`scripts/generate-service-worker.mjs`). |
| `npm run typecheck` | Type check |
| `npm test` | Unit tests (Vitest, `src/lib/__tests__/`) |
| `npm run lint` | Lint (ESLint with Next.js's rules, `eslint.config.mjs`) |
| `npm run android:sync` | `build:static`, then copies the result into the Android project |

To try the production build locally: `npm run build:static && npx serve out`.

### Project layout

| Path | Contents |
| --- | --- |
| `src/app/(app)/` | Pages: dashboard, data-entry, manage-sessions, analysis-report, progress-report, student-profile, goal-templates, settings, help, changelog, privacy |
| `src/components/` | UI, by area (data-entry, forms, charts, reports, settings…) and shadcn components in `ui/` |
| `src/hooks/use-student-data.tsx` | All student, goal and session data, and saving to storage |
| `src/lib/` | Logic without UI: goal types and measures (`goal-constants/`, with the built-in goal statements in `built-in-statements.ts`), goal text (`goal-blanks.ts`), the dashboard's figures (`dashboard.ts`), report narratives, aim lines, service minutes, attendance, session merging, task analysis, encryption (`secure-store.ts`), backups |
| `docs/` | Goal bank review CSV and the original blueprint |

Every pull request runs the type check, lint, the unit tests and the static build (`.github/workflows/checks.yml`). Add or update tests in `src/lib/__tests__/` when you change logic in `src/lib/`.

When you change features, add an entry at the top of `src/app/(app)/changelog/page.tsx`, and update the Help page if the change affects how the app is used.

## Hosting

The static build in `out/` is all that needs hosting. There is no server code.

### Cloudflare (the live site)

`wrangler.jsonc` publishes `out/` as Cloudflare Workers static assets, with the response headers (CSP and security headers) in `public/_headers`. To set it up:

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository** and pick this repository.
2. Set the build command to `npm run build:static` and the deploy command to `npx wrangler deploy`.

Every push to `master` redeploys the live site.

### Netlify (pull request previews)

Netlify builds a preview of each pull request from `netlify.toml`, which has the same build and headers. Netlify adds a "Powered by Netlify" badge in the corner, which the app doesn't hide. That makes it fine for previews but not for the live site.

## Installing on an iPad

1. Open the live app in **Safari**.
2. Tap **Share → Add to Home Screen → Add**.
3. Open AscendEd from the Home Screen once while online, and wait a few seconds so it is saved for offline use.

Updates download in the background and apply the next time the app is opened.

- Data in the Home Screen app is separate from data in Safari.
- Deleting the Home Screen icon deletes the app's data, so back up first.

## Android app

GitHub Actions builds an APK on every push to `master` and on pull requests (`.github/workflows/android-apk.yml`).

1. Open the latest **Android APK** run in the repository's **Actions** tab, or start one with **Run workflow**.
2. Download the **AscendEd-apk** artifact and unzip it to get `app-debug.apk`.
3. Open the APK on the device and allow installing from that source.

Every build is signed with the same key (`android/app/ascended-debug.keystore`), so a new APK installs over the old one and keeps the data. Don't uninstall to update: uninstalling deletes the data.

To build it locally you need Node.js 22, JDK 21 and the Android SDK:

```bash
npm run android:sync
cd android && ./gradlew assembleDebug    # android/app/build/outputs/apk/debug/app-debug.apk
```

## Goal bank

The built-in templates include the SLP goal bank (903 goals). `scripts/import-goal-bank.py` turns the bank's CSV export into templates. For each goal it chooses the data collection type and the session target, based on the skill area and how the goal says success is measured. It also makes the wording consistent (`tidy_text`): "the student" rather than "STUDENT", "they/their" rather than "HIS/HER", "___" for every blank, and one "as measured by" ending.

The other built-in templates (in `src/lib/goal-constants/`) are written as a short sentence; their goal statements are written in the same form by `built-in-statements.ts`.

To update the bank, export it to CSV with the same columns and run:

```bash
python3 scripts/import-goal-bank.py path/to/SLP_Goal_Bank.csv
```

This regenerates these files:
- `src/lib/goal-constants/goal-bank.json`: the templates.
- `public/goal-bank/details.json`: purpose, activity ideas and tags, loaded when a goal is opened.
- `docs/goal-bank-review.csv`: every goal with its type, target and the reason they were chosen.
- `src/lib/goal-constants/goal-bank-type-updates.json`, `goal-bank-text-updates.json` and `goal-bank-renames.json`: what changed since the last import, so devices can update their stored copies.

After changing `tidy_text`, run `python3 scripts/import-goal-bank.py --tidy` to apply it without the CSV.

Devices add new templates automatically, matched by name. Stored templates still in an earlier built-in wording are updated to the current one; templates the user edited, and goals already assigned to students, keep their text.
