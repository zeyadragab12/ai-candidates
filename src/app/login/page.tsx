"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import {
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from "@/lib/supabase/auth";

type Mode = "login" | "signup";

const NOT_ALLOWED_MESSAGE = "This app is restricted to authorized users.";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "not_allowed") {
      setError(NOT_ALLOWED_MESSAGE);
    } else if (errorParam === "oauth_failed") {
      setError("Google sign-in failed. Please try again.");
    }
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    if (!isEmailAllowed(email)) {
      setIsSubmitting(false);
      setError(NOT_ALLOWED_MESSAGE);
      return;
    }

    const { error: authError } =
      mode === "login"
        ? await signInWithPassword(email, password)
        : await signUpWithPassword(email, password);

    setIsSubmitting(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (mode === "signup") {
      setMessage("Account created. Check your email to confirm, then log in.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setError(null);
    setMessage(null);
    setIsGoogleSubmitting(true);

    const { error: authError } = await signInWithGoogle();

    if (authError) {
      setIsGoogleSubmitting(false);
      setError(authError.message);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{mode === "login" ? "Log in" : "Sign up"}</CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Enter your email and password to continue."
              : "Create an account to get started."}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-4">
            <Input
              type="email"
              name="email"
              placeholder="Email"
              required
              autoComplete="email"
            />
            <Input
              type="password"
              name="password"
              placeholder="Password"
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="text-sm text-muted-foreground">
                {message}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? "Please wait..."
                : mode === "login"
                  ? "Log in"
                  : "Sign up"}
            </Button>
            <div className="flex w-full items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isGoogleSubmitting}
              onClick={handleGoogleSignIn}
            >
              {isGoogleSubmitting ? "Redirecting..." : "Continue with Google"}
            </Button>
            <Button
              type="button"
              variant="link"
              className="w-full"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
                setMessage(null);
              }}
            >
              {mode === "login"
                ? "Need an account? Sign up"
                : "Already have an account? Log in"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
