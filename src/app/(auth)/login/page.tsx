'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { APP_NAME } from '@/lib/appConstants';
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const { currentUser, signInAsGuest, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (currentUser && !loading) { 
      router.replace('/dashboard');
    }
  }, [currentUser, loading, router]);

  if (loading && !currentUser) { 
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold">{APP_NAME}</CardTitle>
          <CardDescription>Data is stored locally in this browser.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" onClick={signInAsGuest}>
            <LogIn className="mr-2 h-4 w-4" />
            Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
