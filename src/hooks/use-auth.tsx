
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInAnonymously, 
  signOut as firebaseSignOut, 
  IdTokenResult, 
  signInWithCustomToken as firebaseSignInWithCustomToken,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { auth as authModule, db as firestoreDbModule } from '@/lib/firebase/config'; 
import { doc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { useErrorLog } from './use-error-log';

// Defines a default local guest user object for when Firebase is not available.
const LOCAL_GUEST_USER: User = {
  uid: 'local-guest-user',
  email: 'guest@local.com',
  displayName: 'Guest (Local Mode)',
  isAnonymous: true,
  createdAt: new Date().toISOString(),
};

// Defines the shape of the AuthContext, specifying what values and functions are provided.
interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  error: Error | null; 
  isFirebaseAvailable: boolean;
  signInWithCustomToken: (token: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  getTokenResult: (forceRefresh?: boolean) => Promise<IdTokenResult | null>;
}

// Creates the React Context for authentication. It will hold the authentication state and methods.
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Function to check if Firebase is enabled via localStorage
const checkFirebaseEnabled = () => {
  if (typeof window === 'undefined') return false; // SSR default
  const storedSetting = window.localStorage.getItem('firebase_enabled');
  return storedSetting === null ? false : JSON.parse(storedSetting);
};


/**
 * AuthProvider component.
 * This component provides the authentication context to its children.
 * It manages user authentication state, handles various sign-in/sign-up methods,
 * and interacts with Firebase Authentication and Firestore for user profiles.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State variables to manage the current user, loading status, and any authentication errors.
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFirebaseAvailable, setIsFirebaseAvailable] = useState(false);
  // Access the error logging hook to log authentication-related errors.
  const { addErrorLog } = useErrorLog();

  // Effect hook to listen for Firebase authentication state changes.
  // This runs once on mount and handles initial user loading and local mode fallback.
  useEffect(() => {
    const isEnabled = checkFirebaseEnabled() && !!authModule;
    setIsFirebaseAvailable(isEnabled);

    // If Firebase is not configured, set a local guest user and an error message.
    if (!isEnabled) { 
      setCurrentUser(LOCAL_GUEST_USER); 
      const configError = new Error("Firebase not configured or is disabled in settings. Operating in local mode.");
      setError(configError);
      addErrorLog({ message: configError.message, source: 'useAuth.init', type: 'warning', details: 'Firebase SDK (authModule) is null or disabled.' });
      setLoading(false);
      return;
    }

    // Subscribe to Firebase Auth state changes.
    const unsubscribe = onAuthStateChanged(authModule, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) { // A Firebase user is logged in.
        let userProfileData: Partial<User> = {};
        let userExistsInFirestore = false;

        // Attempt to fetch user profile from Firestore if Firestore DB is available.
        if (firestoreDbModule) {
          const userDocRef = doc(firestoreDbModule, "users", firebaseUser.uid);
          try {
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              userExistsInFirestore = true;
              const firestoreData = userDoc.data();
              // Populate user profile data from Firestore, falling back to FirebaseUser properties.
              userProfileData = {
                displayName: firestoreData.displayName || firebaseUser.displayName,
                createdAt: firestoreData.createdAt, // This will be Firestore Timestamp or converted Date
                email: firestoreData.email || firebaseUser.email, // Prioritize Firestore email if available
              };
            }
          } catch (dbError: any) {
            console.error("Error fetching user document from Firestore:", dbError);
            addErrorLog({ message: 'Error fetching user profile from Firestore.', source: 'useAuth.onAuthStateChanged', details: dbError.message, type: 'error' });
          }
        }
        
        // If Firestore is available, user is not anonymous, has an email, and no Firestore profile exists,
        // create a new user document in Firestore.
        if (firestoreDbModule && !userExistsInFirestore && firebaseUser.email && !firebaseUser.isAnonymous) {
            console.log(`User document for UID ${firebaseUser.uid} not found in 'users' collection. Creating one.`);
            const newDisplayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
            const newUserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: newDisplayName,
              createdAt: serverTimestamp(), // Use Firestore server timestamp for creation time.
            };
            try {
                await setDoc(doc(firestoreDbModule, "users", firebaseUser.uid), newUserProfile);
                userProfileData = { displayName: newDisplayName, createdAt: new Date() }; // Approx createdAt for current session
            } catch (dbError: any) {
                console.error("Error creating user document in Firestore:", dbError);
                addErrorLog({ message: 'Error creating user profile in Firestore.', source: 'useAuth.onAuthStateChanged', details: dbError.message, type: 'error' });
            }
        }

        // Construct the application-specific User object from FirebaseUser and Firestore data.
        const user: User = {
          uid: firebaseUser.uid,
          email: userProfileData.email || firebaseUser.email,
          displayName: userProfileData.displayName || firebaseUser.displayName || (firebaseUser.isAnonymous ? 'Guest' : firebaseUser.email?.split('@')[0] || 'User'),
          isAnonymous: firebaseUser.isAnonymous,
          createdAt: userProfileData.createdAt,
        };
        setCurrentUser(user);
        setError(null);
      } else { // No Firebase user is logged in.
        if (!isEnabled) { // If Firebase is not configured, keep the local guest user.
            setCurrentUser(LOCAL_GUEST_USER); 
        } else { // If Firebase is available but no user, set currentUser to null.
            setCurrentUser(null);
        }
      }
      setLoading(false); // Authentication state determined, set loading to false.
    }, (err: Error) => { // Error handler for onAuthStateChanged.
      console.error("Auth state error:", err);
      setError(err);
      addErrorLog({ message: 'Auth state listener error.', source: 'useAuth.onAuthStateChanged', details: err.message, type: 'error' });
      setCurrentUser(null); 
      setLoading(false);
    });

    // Cleanup function: unsubscribe from the auth state listener when the component unmounts.
    return () => unsubscribe();
  }, [addErrorLog]); // Dependency array: re-run effect if addErrorLog changes (unlikely for a stable function).

  /**
   * Authenticates a user with a custom Firebase authentication token.
   * @param token The custom authentication token.
   */
  const signInWithCustomToken = useCallback(async (token: string) => {
    if (!authModule) {
      const noAuthError = new Error("Firebase Auth is not initialized. Cannot sign in with custom token.");
      setError(noAuthError);
      addErrorLog({ message: noAuthError.message, source: 'useAuth.signInWithCustomToken', type: 'error' });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await firebaseSignInWithCustomToken(authModule, token);
      // The onAuthStateChanged listener will automatically handle setting the currentUser after successful sign-in.
    } catch (e: any) {
      console.error("Error signing in with custom token:", e);
      setError(e as Error);
      addErrorLog({ message: 'Custom token sign-in failed.', source: 'useAuth.signInWithCustomToken', details: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addErrorLog]);

  /**
   * Authenticates a user with email and password.
   * @param email The user's email address.
   * @param password The user's password.
   */
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!authModule) {
      setError(new Error("Firebase Auth is not initialized."));
      addErrorLog({ message: "Firebase Auth not initialized for email sign-in.", source: 'useAuth.signInWithEmail', type: 'error' });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await firebaseSignInWithEmailAndPassword(authModule, email, password);
    } catch (e: any) {
      console.error("Error signing in with email:", e);
      setError(e as Error);
      addErrorLog({ message: 'Email sign-in failed.', source: 'useAuth.signInWithEmail', details: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addErrorLog]);

  /**
   * Creates a new user account with email and password.
   * Optionally sets a display name and creates a corresponding Firestore user document.
   * @param email The new user's email address.
   * @param password The new user's password.
   * @param displayNameInput Optional display name for the user.
   */
  const signUpWithEmail = useCallback(async (email: string, password: string, displayNameInput?: string) => {
    if (!authModule) {
      setError(new Error("Firebase Auth is not initialized."));
      addErrorLog({ message: "Firebase Auth not initialized for email sign-up.", source: 'useAuth.signUpWithEmail', type: 'error' });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const userCredential = await firebaseCreateUserWithEmailAndPassword(authModule, email, password);
      const firebaseUser = userCredential.user;
      // Determine the final display name, prioritizing input, then email part, then a default.
      const finalDisplayName = displayNameInput || email.split('@')[0] || 'New User';

      // Update the Firebase user profile with the chosen display name.
      await updateProfile(firebaseUser, { displayName: finalDisplayName });

      // If Firestore is available, create a new user document in the 'users' collection.
      if (firestoreDbModule) {
        const userDocRef = doc(firestoreDbModule, "users", firebaseUser.uid);
        await setDoc(userDocRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: finalDisplayName,
          createdAt: serverTimestamp(), // Record creation time using a server timestamp.
        });
      }
    } catch (e: any) {
      console.error("Error signing up with email:", e);
      setError(e as Error);
      addErrorLog({ message: 'Email sign-up failed.', source: 'useAuth.signUpWithEmail', details: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addErrorLog]);
  
  /**
   * Signs in the user anonymously (as a guest).
   * If Firebase is not configured, it falls back to a local guest user.
   */
  const signInAsGuest = useCallback(async () => {
    if (!authModule) {
      // Fallback to local guest user if Firebase Auth is not initialized.
      setCurrentUser(LOCAL_GUEST_USER);
      const noAuthError = new Error("Firebase not configured. Operating in local mode.");
      setError(noAuthError);
      addErrorLog({ message: noAuthError.message, source: 'useAuth.signInAsGuest', type: 'warning' });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const userCredential = await signInAnonymously(authModule);
      const firebaseUser = userCredential.user;
      // If Firestore is available, check if an anonymous user document exists; create one if not.
      if (firestoreDbModule) {
        const userDocRef = doc(firestoreDbModule, "users", firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          await setDoc(userDocRef, {
            uid: firebaseUser.uid,
            email: null, 
            displayName: 'Guest',
            isAnonymous: true,
            createdAt: serverTimestamp(),
          });
        }
      }
    } catch (e: any) {
      console.error("Error signing in anonymously:", e);
      setError(e as Error);
      addErrorLog({ message: 'Guest sign-in failed.', source: 'useAuth.signInAsGuest', details: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addErrorLog]);

  /**
   * Signs out the currently authenticated user from Firebase.
   */
  const signOut = useCallback(async () => {
    if (!authModule) {
      // If auth module is not available, simply clear local state.
      setCurrentUser(null); 
      setError(null); 
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await firebaseSignOut(authModule);
    } catch (e: any) {
      console.error("Error signing out:", e);
      setError(e as Error);
      addErrorLog({ message: 'Sign-out failed.', source: 'useAuth.signOut', details: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addErrorLog]);

  /**
   * Retrieves the ID token result for the current user.
   * @param forceRefresh Optional. If true, forces a refresh of the ID token.
   * @returns A promise that resolves to the IdTokenResult or null if no user/error.
   */
  const getTokenResult = useCallback(async (forceRefresh: boolean = false): Promise<IdTokenResult | null> => {
    if (!authModule || !authModule.currentUser) {
      const message = !isFirebaseAvailable ? "Firebase not available for getTokenResult." : "No current Firebase user for getTokenResult.";
      addErrorLog({ message: message, source: 'useAuth.getTokenResult', type: 'warning' });
      return null;
    }
    try {
      return await authModule.currentUser.getIdTokenResult(forceRefresh);
    } catch (e: any) {
      console.error("Error getting token result:", e);
      setError(e as Error);
      addErrorLog({ message: 'Failed to get ID token result.', source: 'useAuth.getTokenResult', details: e.message, type: 'error' });
      return null;
    }
  }, [addErrorLog, isFirebaseAvailable]);

  return (
    // Provides the authentication context values to any child components wrapped by AuthProvider.
    <AuthContext.Provider value={{ currentUser, loading, error, isFirebaseAvailable, signInWithCustomToken, signInWithEmail, signUpWithEmail, signInAsGuest, signOut, getTokenResult }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to consume the AuthContext.
 * Throws an error if used outside of an AuthProvider.
 * @returns The authentication context values.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
