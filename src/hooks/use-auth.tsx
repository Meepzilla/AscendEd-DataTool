
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInAnonymously, signOut as firebaseSignOut, IdTokenResult, signInWithCustomToken as firebaseSignInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase/config'; // This now exports potentially null `auth`
import type { User } from '@/lib/types'; 
import { getInitialAuthTokenFromGlobals } from '@/lib/helpers';
import { Skeleton } from '@/components/ui/skeleton';


interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  error: Error | null;
  signInWithCustomToken: (token: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  getTokenResult: (forceRefresh?: boolean) => Promise<IdTokenResult | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!auth) { // Check if Firebase Auth service was initialized
      setCurrentUser(null);
      setLoading(false);
      setError(new Error("Firebase Auth is not initialized. Please check your Firebase project configuration. Ensure NEXT_PUBLIC_FIREBASE_API_KEY and other related variables are correctly set in your .env file."));
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const user: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          isAnonymous: firebaseUser.isAnonymous,
        };
        setCurrentUser(user);
        setError(null); // Clear error if auth state is good
      } else {
        // No Firebase user. Attempt to sign in as guest if no user is currently set by auth.
        // This handles initial load where user isn't signed in.
        // auth.currentUser check prevents trying to sign in guest if already signed out.
        if (!auth.currentUser) {
          try {
            await signInAnonymously(auth);
            // onAuthStateChanged will be called again with the anonymous user.
          } catch (e) {
            console.error("Error signing in anonymously after initial null user:", e);
            setError(e as Error);
            setCurrentUser(null); // Ensure user is null if anonymous sign-in fails
          }
        } else {
           setCurrentUser(null); // User explicitly signed out or session expired
        }
      }
      setLoading(false);
    }, (err) => {
      console.error("Auth state error:", err);
      setError(err);
      setCurrentUser(null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []); // Run once on mount

  const signInWithCustomToken = useCallback(async (token: string) => {
    if (!auth) {
      setError(new Error("Firebase Auth is not initialized. Cannot sign in with custom token."));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await firebaseSignInWithCustomToken(auth, token);
      // onAuthStateChanged will handle setting the user.
    } catch (e) {
      console.error("Error signing in with custom token:", e);
      setError(e as Error);
      setCurrentUser(null); // Explicitly set user to null on failure
    } finally {
      setLoading(false);
    }
  }, []);
  
  const signInAsGuest = useCallback(async () => {
    if (!auth) {
      setError(new Error("Firebase Auth is not initialized. Cannot sign in as guest."));
      setLoading(false); // Ensure loading state is updated
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signInAnonymously(auth);
      // onAuthStateChanged will set the user
    } catch (e) {
      console.error("Error signing in anonymously:", e);
      setError(e as Error);
      setCurrentUser(null); // Explicitly set user to null on failure
      setLoading(false); // Update loading state on error
    }
    // setLoading(false); // onAuthStateChanged handles this in success cases
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) {
      setError(new Error("Firebase Auth is not initialized. Cannot sign out."));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await firebaseSignOut(auth);
      setCurrentUser(null); // User is set to null by onAuthStateChanged
    } catch (e) {
      console.error("Error signing out:", e);
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getTokenResult = useCallback(async (forceRefresh: boolean = false): Promise<IdTokenResult | null> => {
    if (!auth || !auth.currentUser) {
      // setError(new Error("Firebase Auth is not initialized or no user is signed in."));
      if (!auth) console.error("Firebase Auth not initialized for getTokenResult.");
      else if (!auth.currentUser) console.log("No current user for getTokenResult.");
      return null;
    }
    try {
      return await auth.currentUser.getIdTokenResult(forceRefresh);
    } catch (error) {
      console.error("Error getting token result:", error);
      setError(error as Error);
      return null;
    }
  }, []);

  if (loading && !currentUser && !error) { // Show skeleton only if actively loading and no user/error yet
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
    <AuthContext.Provider value={{ currentUser, loading, error, signInWithCustomToken, signInAsGuest, signOut, getTokenResult }}>
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
