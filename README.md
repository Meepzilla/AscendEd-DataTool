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

## Available Scripts

- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Builds the application for production.
- `npm run start`: Starts the production server.
- `npm run lint`: Runs the linter to check for code quality issues.
- `npm run genkit:dev`: Starts the Genkit development server for AI flow testing.
- `npm run genkit:watch`: Starts the Genkit server in watch mode.

November 15, 2025 at 3:36 PM 
