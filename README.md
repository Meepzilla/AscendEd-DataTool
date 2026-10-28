# Goal Tracker - Student Data Capture App

This is a comprehensive Next.js application designed for educators and therapists to track student progress towards their goals. It features robust data entry, session management, data analysis, and AI-powered assistance.

## Key Features

- **Student Management**: Add, edit, and manage a roster of students.
- **Goal Template Library**: Create, manage, and assign reusable goal templates. Includes a rich default library of common goals.
- **AI-Powered SMART Goals**: Use AI to generate Specific, Measurable, Achievable, Relevant, and Time-bound (SMART) goals from simple prompts.
- **Dynamic Data Entry**: A powerful and flexible data entry page to record session data for multiple students at once, with full keyboard hotkey support for speed.
- **Session Management**: View, edit, and delete historical session data.
- **Analysis & Reports**: Visualize student progress with dynamic charts and generate AI-powered technical summaries of performance.
- **Local Storage**: All data is stored in the browser's local storage on the device; nothing is synced to a cloud backend.
- **Backup & Restore**: Save all data to a JSON backup file from Settings, and restore it on the same or another device (merge or replace). The dashboard reminds you when a backup is more than a week old.
- **Responsive Design**: A modern, responsive interface that works on desktop and mobile devices.

## Tech Stack 

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **UI Library**: [React](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [ShadCN UI](https://ui.shadcn.com/)
- **Charting**: [Recharts](https://recharts.org/)
- **AI Integration**: [Genkit](https://genkit.dev/)
- **Data Storage**: Browser local storage

## Getting Started

Follow these steps to get the application running locally.

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Development Server

Start the Next.js development server:

```bash
npm run dev
```

The application should now be running at [http://localhost:3000](http://localhost:3000).

## iPad and Web App (Home Screen)

The same offline build can be hosted as a website and added to an iPad's Home Screen, where it opens full-screen like an app. A service worker stores the whole app on the device, so after the first visit it works without internet. Student data stays in the device's browser storage; the website only serves the app's code. AI features are hidden, as in the Android app.

### Hosting on Netlify

`netlify.toml` holds the build settings (`npm run build:static`, publishing `out/`). Netlify's free plan works with private repositories.

1. Sign in at [netlify.com](https://www.netlify.com/) (signing in with GitHub is easiest).
2. Choose **Add new project → Import an existing project → GitHub**, and allow Netlify access to this repository.
3. Pick this repository and the `master` branch. The build settings are filled in from `netlify.toml`; click **Deploy**.
4. Optionally rename the site under **Project configuration → Change project name** (for example `ascended-lesd.netlify.app`).

Every push to `master` then redeploys the site automatically.

### Installing on an iPad

1. Open the site in **Safari**.
2. Tap **Share → Add to Home Screen → Add**.
3. Open AscendEd from the Home Screen once while online and wait a few seconds so the app is stored for offline use.

Updates download in the background and apply the next time the app is opened. Deleting the Home Screen icon deletes the app's data, and data entered in the Home Screen app is separate from data entered in Safari itself.

## Android App

The app can be packaged as an Android APK with [Capacitor](https://capacitorjs.com/). The Android app uses the same static build as the iPad/web app and runs fully offline, storing data on the device. The AI features need a server, so they are hidden in the Android app.

### Getting the APK

GitHub Actions builds the APK on every push to `master` and on pull requests (workflow: `.github/workflows/android-apk.yml`). To download it:

1. Open the repository's **Actions** tab and select the latest **Android APK** run. You can also start one with **Run workflow**.
2. Under **Artifacts**, download **AscendEd-apk** and unzip it to get `app-debug.apk`.
3. Copy the APK to the Android device and open it. Android will ask you to allow installing apps from that source.

Every build is signed with the same key (`android/app/ascended-debug.keystore`), so a new APK installs over the previous one and keeps the data on the device. Don't uninstall the app to update it: uninstalling deletes its data.

### Building the APK locally

Requires Node.js 22 or later (needed by the Capacitor CLI), JDK 21, and the Android SDK (for example, through Android Studio).

```bash
npm run android:sync          # static export into out/, copied into android/
cd android && ./gradlew assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. You can also open the `android/` folder in Android Studio to run the app on an emulator or a connected device.

## Available Scripts

- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Builds the application for production.
- `npm run build:static`: Builds the offline static export into `out/` (AI features hidden, service worker generated), used for Netlify and the Android app.
- `npm run android:sync`: Runs `build:static` and copies the result into the Android project.
- `npm run start`: Starts the production server.
- `npm run lint`: Runs the linter to check for code quality issues.
- `npm run genkit:dev`: Starts the Genkit development server for AI flow testing.
- `npm run genkit:watch`: Starts the Genkit server in watch mode.

November 15, 2025 at 3:36 PM 
