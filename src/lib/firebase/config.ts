
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, enableMultiTabIndexedDbPersistence, Firestore } from 'firebase/firestore';
import { getFirebaseConfigFromGlobals } from '@/lib/helpers';

// Attempt to get Firebase config from global variable __firebase_config
const firebaseConfigGlobal = getFirebaseConfigFromGlobals();

// Fallback configuration if global is not set
const fallbackFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const finalFirebaseConfig = firebaseConfigGlobal || fallbackFirebaseConfig;

let app: FirebaseApp | null = null;
let authModule: Auth | null = null; // Renamed to avoid conflict with auth from getAuth
let dbModule: Firestore | null = null; // Renamed

// Check if essential configuration is present
if (finalFirebaseConfig.apiKey && finalFirebaseConfig.projectId) {
  try {
    if (!getApps().length) {
      app = initializeApp(finalFirebaseConfig);
    } else {
      app = getApp();
    }

    authModule = getAuth(app);
    dbModule = getFirestore(app);

    if (process.env.NODE_ENV === 'development') {
      if (authModule && !(authModule as any).emulatorConfig) {
        try {
          connectAuthEmulator(authModule, 'http://localhost:9099', { disableWarnings: true });
          console.log('Auth emulator connected');
        } catch (error) {
          console.warn('Auth emulator connection failed (may already be connected or not running):', error);
        }
      }
      if (dbModule && !(dbModule as any).emulatorConfig) {
         try {
          connectFirestoreEmulator(dbModule, 'localhost', 8080);
          console.log('Firestore emulator connected');
        } catch (error) {
          console.warn('Firestore emulator connection failed (may already be connected or not running):', error);
        }
      }
    }

    if (typeof window !== 'undefined' && dbModule) {
      enableMultiTabIndexedDbPersistence(dbModule)
        .catch((err) => {
          if (err.code === 'failed-precondition') {
            console.warn('Firestore: Multiple tabs open, persistence can only be enabled in one tab at a time.');
          } else if (err.code === 'unimplemented') {
            console.warn('Firestore: The current browser does not support all of the features required to enable persistence.');
          } else {
            console.error('Firestore: Error enabling offline persistence:', err);
          }
        });
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error(`Firebase initialization error: ${errorMessage}. Check your Firebase config (e.g. API key). Full error details may follow if applicable or can be found in browser console during debugging.`);
    // Log the original error if needed for deeper debugging but avoid passing the full object directly if it causes overlay issues
    // console.error("Original Firebase initialization error object:", e); 
    app = null;
    authModule = null;
    dbModule = null;
  }
} else {
  console.error("Firebase API Key or Project ID is missing from config. Firebase services will not be initialized. Please ensure NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_PROJECT_ID are set in your .env file or that Firebase is otherwise correctly configured.");
  // app, authModule, dbModule remain null
}

export { app, authModule as auth, dbModule as db };
