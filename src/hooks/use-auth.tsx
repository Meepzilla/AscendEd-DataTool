
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
import { Skeleton } from '@/components/ui/skeleton';
import { useErrorLog } from './use-error-log';

const LOCAL_GUEST_USER: User = {
  uid: 'local-guest-user',
  email: 'guest@local.com',
  displayName: 'Guest (Local Mode)',
  isAnonymous: true,
  createdAt: new Date().toISOString(),
};

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFirebaseAvailable, setIsFirebaseAvailable] = useState(!!authModule);
  const { addErrorLog } = useErrorLog();

  useEffect(() => {
    if (!authModule) { 
      setIsFirebaseAvailable(false);
      setCurrentUser(LOCAL_GUEST_USER); 
      const configError = new Error("Firebase not configured. Operating in local mode. Some features like cloud sync will be unavailable.");
      setError(configError);
      addErrorLog({ message: configError.message, source: 'useAuth.init', type: 'warning', details: 'Firebase SDK (authModule) is null.' });
      setLoading(false);
      return;
    }

    setIsFirebaseAvailable(true);
    const unsubscribe = onAuthStateChanged(authModule, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        let userProfileData: Partial<User> = {};
        let userExistsInFirestore = false;

        if (firestoreDbModule) {
          const userDocRef = doc(firestoreDbModule, "users", firebaseUser.uid);
          try {
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              userExistsInFirestore = true;
              const firestoreData = userDoc.data();
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
        
        // If user is authenticated (not anonymous or email verified) but not in Firestore, create entry
        // This handles cases where user was created before 'users' collection logic or if they verified email after anonymous sign-in.
        // Ensure not to run this for every anonymous login, only if they become non-anonymous or if no profile exists.
        if (firestoreDbModule && !userExistsInFirestore && firebaseUser.email && !firebaseUser.isAnonymous) {
            console.log(`User document for UID ${firebaseUser.uid} not found in 'users' collection. Creating one.`);
            const newDisplayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
            const newUserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: newDisplayName,
              createdAt: serverTimestamp(),
            };
            try {
                await setDoc(doc(firestoreDbModule, "users", firebaseUser.uid), newUserProfile);
                userProfileData = { displayName: newDisplayName, createdAt: new Date() }; // Approx createdAt for current session
            } catch (dbError: any) {
                console.error("Error creating user document in Firestore:", dbError);
                addErrorLog({ message: 'Error creating user profile in Firestore.', source: 'useAuth.onAuthStateChanged', details: dbError.message, type: 'error' });
            }
        }


        const user: User = {
          uid: firebaseUser.uid,
          email: userProfileData.email || firebaseUser.email,
          displayName: userProfileData.displayName || firebaseUser.displayName || (firebaseUser.isAnonymous ? 'Guest' : firebaseUser.email?.split('@')[0] || 'User'),
          isAnonymous: firebaseUser.isAnonymous,
          createdAt: userProfileData.createdAt,
        };
        setCurrentUser(user);
        setError(null);
      } else { // No Firebase user
        if (!isFirebaseAvailable) { // Local mode
            setCurrentUser(LOCAL_GUEST_USER); 
        } else { // Firebase available, but user signed out
            setCurrentUser(null);
        }
      }
      setLoading(false);
    }, (err: Error) => {
      console.error("Auth state error:", err);
      setError(err);
      addErrorLog({ message: 'Auth state listener error.', source: 'useAuth.onAuthStateChanged', details: err.message, type: 'error' });
      setCurrentUser(null); 
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isFirebaseAvailable, addErrorLog]); // Removed firestoreDbModule from deps as it's stable or checked inside

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
      // onAuthStateChanged will handle setting currentUser
    } catch (e: any) {
      console.error("Error signing in with custom token:", e);
      setError(e as Error);
      addErrorLog({ message: 'Custom token sign-in failed.', source: 'useAuth.signInWithCustomToken', details: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addErrorLog]);

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
      // onAuthStateChanged will handle setting currentUser and fetching/creating Firestore profile
    } catch (e: any) {
      console.error("Error signing in with email:", e);
      setError(e as Error);
      addErrorLog({ message: 'Email sign-in failed.', source: 'useAuth.signInWithEmail', details: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addErrorLog]);

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
      const finalDisplayName = displayNameInput || email.split('@')[0] || 'New User';

      await updateProfile(firebaseUser, { displayName: finalDisplayName });

      if (firestoreDbModule) {
        const userDocRef = doc(firestoreDbModule, "users", firebaseUser.uid);
        await setDoc(userDocRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: finalDisplayName,
          createdAt: serverTimestamp(),
        });
      }
      // onAuthStateChanged will handle setting currentUser from the new user state
    } catch (e: any) {
      console.error("Error signing up with email:", e);
      setError(e as Error);
      addErrorLog({ message: 'Email sign-up failed.', source: 'useAuth.signUpWithEmail', details: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addErrorLog]);
  
  const signInAsGuest = useCallback(async () => {
    if (!authModule) {
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
      // Check if anonymous user profile needs to be created in Firestore
      if (firestoreDbModule) {
        const userDocRef = doc(firestoreDbModule, "users", firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          await setDoc(userDocRef, {
            uid: firebaseUser.uid,
            email: null, // Anonymous users don't have email
            displayName: 'Guest',
            isAnonymous: true,
            createdAt: serverTimestamp(),
          });
        }
      }
      // onAuthStateChanged will handle setting currentUser
    } catch (e: any) {
      console.error("Error signing in anonymously:", e);
      setError(e as Error);
      addErrorLog({ message: 'Guest sign-in failed.', source: 'useAuth.signInAsGuest', details: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addErrorLog]);

  const signOut = useCallback(async () => {
    if (!authModule) {
      setCurrentUser(null); 
      setError(null); 
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await firebaseSignOut(authModule);
      // onAuthStateChanged will set currentUser to null or LOCAL_GUEST_USER
    } catch (e: any) {
      console.error("Error signing out:", e);
      setError(e as Error);
      addErrorLog({ message: 'Sign-out failed.', source: 'useAuth.signOut', details: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addErrorLog]);

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
  }, [isFirebaseAvailable, addErrorLog]);

  if (loading && !currentUser && (!error || (error && error.message.includes("Firebase not configured")))) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card w-full max-w-md text-center">
            <Skeleton className="h-12 w-12 rounded-full mx-auto bg-primary/20" />
            <Skeleton className="h-6 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
            <Skeleton className="h-10 w-full mt-4" />
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ currentUser, loading, error, isFirebaseAvailable, signInWithCustomToken, signInWithEmail, signUpWithEmail, signInAsGuest, signOut, getTokenResult }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
