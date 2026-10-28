// Feature flags set at build time.

// AI features run as server actions, so they are turned off for builds with no server
// (the Android app). Set NEXT_PUBLIC_AI_ENABLED=false to hide them.
export const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED !== 'false';
