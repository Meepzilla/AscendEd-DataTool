// Feature flags set at build time.

// AI features run as server actions and send student data (names, notes, goal data) to an AI service, so they
// are off unless a build sets NEXT_PUBLIC_AI_ENABLED=true. Builds with no server (the Android app and the
// installable web app) can't run them at all.
export const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === 'true';
