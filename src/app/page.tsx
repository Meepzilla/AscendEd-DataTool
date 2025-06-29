'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { APP_NAME } from '@/lib/constants';

/**
 * HomePage component.
 * This is the root page of the application, responsible for redirecting users
 * to either the dashboard (if authenticated) or the login page (if not).
 * It displays a loading state while authentication status is being determined.
 */
export default function HomePage() {
  // Destructure currentUser and loading state from the authentication hook.
  const { currentUser, loading } = useAuth();
  // Initialize Next.js router for programmatic navigation.
  const router = useRouter();

  // Effect hook to handle redirection based on authentication status.
  useEffect(() => {
    // Only proceed if authentication loading has completed.
    if (!loading) {
      // If a user is authenticated, redirect to the dashboard.
      if (currentUser) {
        router.replace('/dashboard');
      } else { // If no user is authenticated, redirect to the login page.
        router.replace('/login');
      }
    }
  }, [currentUser, loading, router]); // Dependencies for the effect: re-run if these values change

  // Render a loading state while authentication is in progress.
  // This provides immediate feedback to the user and prevents flashing of unauthenticated content.
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card w-full max-w-md text-center">
        {/* Application icon, animated to indicate loading */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-12 w-12 text-primary mx-auto animate-pulse">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.09L6.71 11.8l1.41-1.41L11 13.27l4.88-4.88 1.41 1.41L11 16.09z"/>
        </svg>
        {/* Application name */}
        <h1 className="text-2xl font-bold">{APP_NAME}</h1>
        {/* Loading message for accessibility and user feedback */}
        <p data-testid="loading-message" className="text-muted-foreground">Loading application, please wait...</p>
        {/* Skeleton loaders to indicate content is coming */}
        <div className="pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6 mt-2" />
        </div>
      </div>
    </div>
  );
}
