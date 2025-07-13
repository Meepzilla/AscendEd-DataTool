
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
import { APP_NAME } from '@/lib/appConstants';
import { UserPlus, AlertCircle, LogIn } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { SignUpSchema } from "@/lib/types";

type SignUpFormData = z.infer<typeof SignUpSchema>;

export default function SignUpPage() {
  const { currentUser, signUpWithEmail, loading, error: authError, isFirebaseAvailable } = useAuth();
  const router = useRouter();
  const [pageError, setPageError] = useState<string | null>(null);

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (currentUser && !loading) { 
      router.replace('/dashboard');
    }
  }, [currentUser, loading, router]);

  useEffect(() => {
    if (authError) {
      setPageError(authError.message);
    } else {
      setPageError(null);
    }
  }, [authError]);

  const onSubmit = async (data: SignUpFormData) => {
    setPageError(null);
    if (!isFirebaseAvailable) {
      setPageError("Sign-up is not available in local mode.");
      return;
    }

    await signUpWithEmail(data.email, data.password, data.displayName);
    // Redirection is handled by the useEffect above
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <UserPlus className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold">Create an Account</CardTitle>
          <CardDescription>Join {APP_NAME} to start tracking student progress.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pageError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sign-Up Error</AlertTitle>
              <AlertDescription>{pageError}</AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Jane Doe" {...field} disabled={loading || !isFirebaseAvailable} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} disabled={loading || !isFirebaseAvailable} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading || !isFirebaseAvailable}>
                <UserPlus className="mr-2 h-4 w-4" />
                {loading ? 'Creating Account...' : 'Sign Up'}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="underline hover:text-primary">
              <LogIn className="inline-block h-4 w-4 mr-1" />
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
