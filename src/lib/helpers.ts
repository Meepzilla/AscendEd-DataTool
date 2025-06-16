
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | Timestamp | string): string {
  let d: Date;
  if (date instanceof Timestamp) {
    d = date.toDate();
  } else if (typeof date === 'string') {
    d = new Date(date);
  } else {
    d = date;
  }
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(date: Date | Timestamp | string): string {
   let d: Date;
  if (date instanceof Timestamp) {
    d = date.toDate();
  } else if (typeof date === 'string') {
    d = new Date(date);
  } else {
    d = date;
  }
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Add more helper functions as needed, e.g., for data transformation, validation, etc.

/**
 * Delays execution for a specified number of milliseconds.
 * @param ms The number of milliseconds to wait.
 * @returns A promise that resolves after the delay.
 */
export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Placeholder for client-side Firebase configuration value.
 * In a real app, this would be securely managed.
 * Example: populated from a script tag or environment variable accessible on the client.
 */
export function getFirebaseConfigFromGlobals(): any {
  if (typeof window !== 'undefined' && (window as any).__firebase_config) {
    try {
      return JSON.parse((window as any).__firebase_config);
    } catch (error) {
      console.error("Error parsing __firebase_config:", error);
      return null;
    }
  }
  return null;
}

export function getAppIdFromGlobals(): string | null {
   if (typeof window !== 'undefined' && (window as any).__app_id) {
    return (window as any).__app_id;
  }
  return null;
}

export function getInitialAuthTokenFromGlobals(): string | null {
  if (typeof window !== 'undefined' && (window as any).__initial_auth_token) {
    return (window as any).__initial_auth_token;
  }
  return null;
}
