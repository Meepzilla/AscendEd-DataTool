
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInAnonymously, signOut as firebaseSignOut, IdTokenResult, signInWithCustomToken as firebaseSignInWithCustomToken } from 'firebase/auth';
import { auth as authModule } from '@/lib/firebase/config'; // Renamed import
import type { User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

// Define a local guest user structure
const LOCAL_GUEST_USER: User = {
  uid: 'local-guest-user',
  email: 'guest@local.com',
  displayName: 'Guest (Local Mode)',
  isAnonymous: true,
};

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  error: Error | null; // Can indicate Firebase init error or regular auth errors
  isFirebaseAvailable: boolean;
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
  const [isFirebaseAvailable, setIsFirebaseAvailable] = useState(!!authModule);

  useEffect(() => {
    if (!authModule) { // Firebase Auth service not initialized
      setIsFirebaseAvailable(false);
      setCurrentUser(LOCAL_GUEST_USER); // Set local guest user
      setError(new Error("Firebase not configured. Operating in local mode. Some features like cloud sync will be unavailable."));
      setLoading(false);
      return;
    }

    setIsFirebaseAvailable(true);
    const unsubscribe = onAuthStateChanged(authModule, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const user: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          isAnonymous: firebaseUser.isAnonymous,
        };
        setCurrentUser(user);
        setError(null);
      } else {
         // If no Firebase user and not already in local mode, attempt guest sign-in
        if (isFirebaseAvailable && !authModule.currentUser) {
             try {
                await signInAnonymously(authModule);
             } catch (e) {
                console.error("Error signing in anonymously after initial null user:", e);
                setError(e as Error);
                setCurrentUser(null);
             }
        } else if (!isFirebaseAvailable) {
            setCurrentUser(LOCAL_GUEST_USER); // Revert to local guest if Firebase was available then signed out
        }
         else {
            setCurrentUser(null);
        }
      }
      setLoading(false);
    }, (err) => {
      console.error("Auth state error:", err);
      setError(err);
      setCurrentUser(null); // Fallback to no user on error
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isFirebaseAvailable]); // isFirebaseAvailable helps re-evaluate if config changes (though unlikely in SPA lifecycle)

  const signInWithCustomToken = useCallback(async (token: string) => {
    if (!authModule) {
      setError(new Error("Firebase Auth is not initialized. Cannot sign in with custom token."));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await firebaseSignInWithCustomToken(authModule, token);
    } catch (e) {
      console.error("Error signing in with custom token:", e);
      setError(e as Error);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  
  const signInAsGuest = useCallback(async () => {
    if (!authModule) {
      setCurrentUser(LOCAL_GUEST_USER);
      setError(new Error("Firebase not configured. Operating in local mode."));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signInAnonymously(authModule);
    } catch (e) {
      console.error("Error signing in anonymously:", e);
      setError(e as Error);
      setCurrentUser(null); // If actual Firebase guest sign-in fails
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!authModule) {
      setCurrentUser(null); // Clear local guest user
      setError(null); // Clear local mode error
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await firebaseSignOut(authModule);
      // onAuthStateChanged will handle setting currentUser to null.
      // If we want to immediately switch to local guest on sign out from Firebase:
      // setCurrentUser(LOCAL_GUEST_USER); 
      // setError(new Error("Signed out from Firebase. Operating in local mode."));
    } catch (e) {
      console.error("Error signing out:", e);
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getTokenResult = useCallback(async (forceRefresh: boolean = false): Promise<IdTokenResult | null> => {
    if (!authModule || !authModule.currentUser) {
      if (!isFirebaseAvailable) console.log("Firebase not available for getTokenResult.");
      else console.log("No current Firebase user for getTokenResult.");
      return null;
    }
    try {
      return await authModule.currentUser.getIdTokenResult(forceRefresh);
    } catch (error) {
      console.error("Error getting token result:", error);
      setError(error as Error);
      return null;
    }
  }, [isFirebaseAvailable]);

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
    <AuthContext.Provider value={{ currentUser, loading, error, isFirebaseAvailable, signInWithCustomToken, signInAsGuest, signOut, getTokenResult }}>
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
