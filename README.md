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
- 21 goal types, each with its own controls and measure, including:
  - accuracy counts and trial grids;
  - prompt levels, fluency, communication functions, story elements and task analysis;
  - behavior frequency, duration, ABC, interval and latency (behavior times can be corrected by hand);
  - Goal Attainment Scaling (GAS): a level from −2 to +2 per session, with the goal's own written description of each level.
- Keyboard shortcuts for fast entry. Unsaved work survives switching pages or closing the app.
- Missed sessions are recorded with a reason. Sessions saved in parts can be merged so their minutes count once. Saved sessions can be edited, date and times included.

**Students and goals**
- A goal bank of over 900 templates, searchable by skill area, with purpose and activity ideas, including 20 GAS goals with all five levels written out. Built-in goals can be hidden, or deleted and restored later (Settings → Built-in goals).
- The goal editors list what saving will change, old value to new.
- Every built-in goal reads the same way: "By [date], the student will … with 80% accuracy across 3 consecutive sessions, as measured by …".
- Custom goals are written from the goal text alone (Assign / Create Goal → Write a custom goal): the name, goal type, target, direction and target date are suggested from its wording (the same reading as the student import) and can be changed, with the baseline, mastery and an option to save it as a template.
- Each goal has a target, a direction (increase or decrease), a target date, a baseline and mastery criteria. The goal text follows them: placeholders such as "[student]", "[date]", "[target]", "[opportunities]", "[sessions]", "[annual review]" and "[service minutes]" (`goal-placeholders.ts`, with chips to insert them in the goal and template editors), the student's name, blanks ("___"), the stated percentage and the consecutive sessions are filled in from the goal's settings, in goal bank and custom goals alike. The number of opportunities ("4 out of 5 opportunities") stays as written unless it is the goal's only target.
- Import students from an IEP at a Glance PDF (a page per student, as SLP Toolkit makes them) or a spreadsheet (Excel .xlsx or CSV, one row per student): names, IEP start and end dates, service minutes and goals. Each goal is given a goal type from its wording, which can be changed before anything is saved.
- Each student's profile shows IEP dates, service minutes against the IEP (per week, month or school year) and attendance, with a View Report button for that student's charts and Progress Report.

**Reports**
- A chart per goal, with the target line and the aim line; tap a goal's title for its full text, and a figure marked ⓘ for how it is worked out.
- For GAS goals, a T-score line graph over time (all of a student's GAS goals combined, Kiresuk & Sherman formula), a summary table and the attainment-level distribution.
- Written progress narratives in brief or detailed style.
- A printable IEP progress report, with optional service minutes and your school or district name at the top.
- CSV export and import of session data.

**Privacy and safety**
- Optional passcode protection: student data is encrypted on the device (AES-256), with a recovery key shown once when the passcode is set.
- Backups to a file, optionally password-protected; restoring can merge or replace.
- A Student Access Lock with a PIN.
- A strict Content Security Policy: only the app's own scripts can run.
- A [Privacy Notice](src/app/(app)/privacy/page.tsx) page in the app.

Four color themes (Settings → Interface): Dark (the default, navy and gold), Light (white and gold), High Contrast (black, white and bright yellow) and Pastel (soft lavender, baby blue and mint, with plum buttons), saved on each device. All four meet WCAG AA text contrast.

The menu bar can sit at the top or the bottom of the screen (Settings → Interface); at the bottom it stays in reach while scrolling and sits above the footer.

In the app, a **Getting Started** checklist on the Dashboard walks a new user through the five steps (add a student, give them goals, record a session, see their progress, back up), ticking each off as it's done (Help can bring it back after it is hidden). The **Help** page (Alt + H) explains each feature, and **What's New** (the account menu, or Alt + 6) lists what changed. Keyboard shortcut hints are hidden on touch screens until a hardware keyboard is used.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router) with a static export, plus [React 19](https://react.dev/) and [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) and Radix UI
- [Recharts](https://recharts.org/) for charts
- IndexedDB for students, goal templates and sessions (one row per record) and `localStorage` for smaller items, with Web Crypto for passcode encryption; the app requests persistent storage
- [zod](https://zod.dev/) for validating forms and backups, and [pdf.js](https://mozilla.github.io/pdf.js/) (bundled, run locally) for reading IEP at a Glance PDFs
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
| `src/lib/` | Logic without UI: goal types and measures (`goal-constants/`, with the built-in goal statements in `built-in-statements.ts`), goal text (`goal-blanks.ts`), the dashboard's figures (`dashboard.ts`), report narratives, aim lines, service minutes, attendance, session merging, task analysis, encryption (`secure-store.ts`), backups, importing students from a spreadsheet or PDF (`student-import.ts`, with the .xlsx reader in `xlsx-read.ts` and the PDF text reader, using pdf.js, in `pdf-text.ts`) |
| `docs/` | Goal bank review CSV and the original blueprint |

Every pull request runs the type check, lint, the unit tests and the static build (`.github/workflows/checks.yml`). Add or update tests in `src/lib/__tests__/` when you change logic in `src/lib/`.

When you change features, add an entry at the top of `src/app/(app)/changelog/page.tsx`, and update the Help page if the change affects how the app is used.

## Hosting

The static build in `out/` is all that needs hosting. There is no server code. It is also the only supported deployment: the plain `next build` / `next start` server path is not supported. It produces no `out/` directory, so `scripts/add-csp.mjs` (which adds the per-page script-src CSP) has nothing to run on, and a dev or server deployment gets no script-src CSP. Do not deploy from `npm run build` or `npm run start`.

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

GitHub Actions builds the app on every push to `master` and on pull requests (`.github/workflows/android-apk.yml`). It publishes an installable APK only when the private release key is in the repository's secrets; without it the build is a check only. No signing key is kept in the repository: debug builds use each machine's own debug key and are for testing only.

**Setting up the release key (one time).** On your own computer (not in the repository), with a JDK installed:

```bash
keytool -genkeypair -v -keystore ascended-release.keystore -alias ascended -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 ascended-release.keystore > ascended-release.keystore.b64   # macOS: base64 -i ascended-release.keystore
```

Then in GitHub: Settings → Secrets and variables → Actions → New repository secret, add `ANDROID_KEYSTORE_BASE64` (the contents of the `.b64` file), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`ascended`) and `ANDROID_KEY_PASSWORD`. Keep the keystore file and passwords somewhere safe outside the repository (a password manager): every future update must be signed with the same key, and a lost key means teachers have to reinstall.

**Installing.** Open the latest **Android APK** run in the repository's **Actions** tab (or start one with **Run workflow**), download the **AscendEd-apk** artifact, unzip it to get `AscendEd.apk`, and open it on the device (allow installing from that source). Later APKs install over it and keep the data. Don't uninstall to update: uninstalling deletes the data.

**Moving from an earlier build (one time).** APKs built before 7 November 2026 were signed with a development key that was published in this repository, so Android won't let the new, release-signed APK update them. On each device: save a backup in the old app (Settings → Backup & Restore), uninstall it, install the new APK and restore the backup (Replace).

**Moving to the new app ID (one time).** The app's ID is now `io.github.meepzilla.ascended` (it no longer names a school district), so Android treats it as a different app: it installs next to the old one, doesn't update it, and starts empty. On each device that has the old app:
1. In the old app, open Settings → Backup & Restore and save a backup.
2. Install the new APK.
3. In the new app, open Settings → Backup & Restore and restore that backup (Replace).
4. Check the students and sessions, then uninstall the old app. Uninstalling the old app deletes its data, so only do this after step 3.

To build it locally you need Node.js 22, JDK 21 and the Android SDK:

```bash
npm run android:sync
cd android && ./gradlew assembleDebug    # a test build: android/app/build/outputs/apk/debug/app-debug.apk
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
