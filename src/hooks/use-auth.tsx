'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@/lib/types';

// The single local user: a local profile, not an account and not an auth boundary. There is no password,
// no server and nothing to check: anyone who can open the app on the device can open this profile
// (the login page is just a Continue button), and leaving it does not protect the data, which stays
// in this browser's localStorage. Passcode Protection is the thing that keeps student data private.
// Data is stored in the browser's localStorage, keyed by this uid, so the uid must stay stable for
// existing data to keep loading.
const LOCAL_USER: User = {
  uid: 'local-guest-user',
  email: 'guest@local.com',
  displayName: 'Guest',
  isAnonymous: true,
  createdAt: new Date().toISOString(),
};

// Defines the shape of the AuthContext, specifying what values and functions are provided.
interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

// Creates the React Context for authentication. It will hold the authentication state and methods.
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider component.
 * Provides the local profile: the user is either using the local profile or has left it. This is
 * not authentication — there is no account, no credential and no check — and it must not be
 * presented as keeping the data private. (The names signInAsGuest and signOut are kept so the
 * callers don't change; they open and leave the local profile.)
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCurrentUser(LOCAL_USER);
    setLoading(false);
  }, []);

  /**
   * Opens the local profile. Nothing is checked: this is not a sign-in to an account.
   */
  const signInAsGuest = useCallback(async () => {
    setCurrentUser(LOCAL_USER);
  }, []);

  /**
   * Leaves the local profile. Stored data is kept on the device and the profile can be opened
   * again without anything to check, so this does not lock or protect the data.
   */
  const signOut = useCallback(async () => {
    setCurrentUser(null);
  }, []);

  return (
    // Provides the authentication context values to any child components wrapped by AuthProvider.
    <AuthContext.Provider value={{ currentUser, loading, signInAsGuest, signOut }}>
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
