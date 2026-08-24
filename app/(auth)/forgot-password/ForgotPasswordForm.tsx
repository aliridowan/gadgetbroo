"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { LoadingButton } from "@/components/loading-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "@/zodSchemas/forgotPasswordSchema";

interface ApiErrorResponse {
  message?: string;
}

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: ForgotPasswordValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      });

      if (!res.ok) {
        const errorData: ApiErrorResponse = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Something went wrong. Please try again.");
      }

      // Shown regardless of whether the email actually matched an
      // account — better-auth's own response is identical either way
      // (see request-password-reset in its source: same status, same
      // message, whether or not a user was found), specifically so this
      // page can never be used to check which emails are registered.
      // We're just mirroring that same non-committal outcome here, not
      // adding a second layer of ambiguity on top of it.
      setSubmitted(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <MailCheck className="mb-2 h-10 w-10 text-primary" />
          <CardTitle className="text-lg md:text-xl">Check your email</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            If an account exists for that email address, we&apos;ve sent a link to reset your password.
            It expires in 1 hour.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <div className="flex w-full justify-center border-t pt-4">
            <p className="text-muted-foreground text-center text-xs">
              <Link href="/sign-in" className="underline">
                Back to sign in
              </Link>
            </p>
          </div>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">Forgot password</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Enter your email and we&apos;ll send you a link to reset your password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <LoadingButton type="submit" className="w-full cursor-pointer" loading={submitting}>
              Send reset link
            </LoadingButton>
          </form>
        </Form>
      </CardContent>
      <CardFooter>
        <div className="flex w-full justify-center border-t pt-4">
          <p className="text-muted-foreground text-center text-xs">
            Remembered your password?{" "}
            <Link href="/sign-in" className="underline">
              Sign in
            </Link>
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}
