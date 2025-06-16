'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';


export default function HomePage() {
  const { currentUser, loading }_ = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (currentUser) {
        router.replace('/dashboard'); // Or your main app page
      } else {
        router.replace('/login');
      }
    }
  }, [currentUser, loading, router]);

  return (
     <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card w-full max-w-md text-center">
            <Skeleton className="h-12 w-12 rounded-full mx-auto bg-primary/20 animate-pulse" />
            <Skeleton className="h-6 w-3/4 mx-auto animate-pulse" />
            <Skeleton className="h-4 w-1/2 mx-auto animate-pulse" />
            <p className="text-muted-foreground mt-2">Loading application...</p>
        </div>
      </div>
  );
}
