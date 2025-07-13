'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from 'next/link';
import { APP_NAME } from '@/lib/appConstants';
import { LogIn, AlertCircle, WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SignInSchema } from "@/lib/types";

type SignInFormData = z.infer<typeof SignInSchema>;

export default function LoginPage() {
  const { currentUser, signInAsGuest, signInWithEmail, loading, error: authError, isFirebaseAvailable } = useAuth();
  const router = useRouter();

  const form = useForm<SignInFormData>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (currentUser && !loading) { 
      router.replace('/dashboard');
    }
  }, [currentUser, loading, router]);

  const onEmailSignIn = async (data: SignInFormData) => {
    await signInWithEmail(data.email, data.password);
  };
  
  if (loading && !currentUser) { 
    return <div className="flex items-center justify-center min-h-screen">Loading authentication...</div>;
  }
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold">{APP_NAME}</CardTitle>
          <CardDescription>Sign in to manage student goals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {authError && (
             <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Authentication Error</AlertTitle>
              <AlertDescription>
                {authError.message.includes('auth/invalid-credential') 
                    ? 'Invalid email or password. Please check your credentials and try again.' 
                    : 'An unexpected error occurred. Please try again later.'}
              </AlertDescription>
            </Alert>
          )}

          {!isFirebaseAvailable && (
             <Alert variant="default" className="border-yellow-500 bg-yellow-50/50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700">
              <WifiOff className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
              <AlertTitle>Local Mode Active</AlertTitle>
              <AlertDescription>
                Email login is unavailable. Please use Guest Sign In.
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEmailSignIn)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="m@example.com" {...field} disabled={loading || !isFirebaseAvailable} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} disabled={loading || !isFirebaseAvailable} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading || !isFirebaseAvailable}>
                <LogIn className="mr-2 h-4 w-4" />
                {loading && isFirebaseAvailable ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>
          </Form>

          <div className="mt-4 text-center text-sm">
            <Link href="/signup" className="text-muted-foreground hover:text-primary underline">
              Don't have an account? Sign Up
            </Link>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={signInAsGuest} disabled={loading && isFirebaseAvailable}>
            {loading && isFirebaseAvailable ? 'Processing...' : 'Continue as Guest'}
            {!isFirebaseAvailable && " (Local Mode)"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
