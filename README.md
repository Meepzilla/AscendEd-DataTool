# Goal Tracker - Student Data Capture App

This is a comprehensive Next.js application designed for educators and therapists to track student progress towards their goals. It features robust data entry, session management, data analysis, and AI-powered assistance.

## Key Features

- **Student Management**: Add, edit, and manage a roster of students.
- **Goal Template Library**: Create, manage, and assign reusable goal templates. Includes a rich default library of common goals.
- **AI-Powered SMART Goals**: Use AI to generate Specific, Measurable, Achievable, Relevant, and Time-bound (SMART) goals from simple prompts.
- **Dynamic Data Entry**: A powerful and flexible data entry page to record session data for multiple students at once, with full keyboard hotkey support for speed.
- **Session Management**: View, edit, and delete historical session data.
- **Analysis & Reports**: Visualize student progress with dynamic charts and generate AI-powered technical summaries of performance.
- **Firebase Integration**: Securely syncs all data to the cloud using Firebase Authentication and Firestore, with a seamless fallback to local browser storage if offline or not configured.
- **Responsive Design**: A modern, responsive interface that works on desktop and mobile devices.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **UI Library**: [React](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [ShadCN UI](https://ui.shadcn.com/)
- **Charting**: [Recharts](https://recharts.org/)
- **AI Integration**: [Genkit](https://firebase.google.com/docs/genkit)
- **Backend & Database**: [Firebase](https://firebase.google.com/) (Authentication & Firestore)

## Getting Started

Follow these steps to get the application running locally.

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root of the project and add your Firebase project credentials. You can get these from the Firebase console.

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**Note**: If you do not provide Firebase credentials, the application will run in a "local-only" mode, where all data is stored in your browser's local storage and will not be synced to the cloud.

### 3. Run the Development Server

Start the Next.js development server:

```bash
npm run dev
```

The application should now be running at [http://localhost:3000](http://localhost:3000).

## Available Scripts

- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Builds the application for production.
- `npm run start`: Starts the production server.
- `npm run lint`: Runs the linter to check for code quality issues.
- `npm run genkit:dev`: Starts the Genkit development server for AI flow testing.
- `npm run genkit:watch`: Starts the Genkit server in watch mode.
