"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { LoadingButton } from "@/components/loading-button";
import { PasswordInput } from "@/components/password-input";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/zodSchemas/resetPasswordSchema";

interface ApiErrorResponse {
  message?: string;
  code?: string;
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  async function onSubmit({ newPassword }: ResetPasswordValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, token }),
      });

      if (!res.ok) {
        const errorData: ApiErrorResponse = await res.json().catch(() => ({}));
        // The token was valid when the page loaded (we only render this
        // form when it is), but it's single-use and time-limited — it can
        // still expire or get consumed between then and submit (a double
        // submit, or just sitting on the page too long).
        if (errorData.code === "INVALID_TOKEN") {
          throw new Error("This link has expired or was already used. Request a new one.");
        }
        throw new Error(errorData.message || "Failed to reset password. Please try again.");
      }

      toast.success("Password reset — sign in with your new password.");
      router.push("/sign-in");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reset password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">Set a new password</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Choose a new password for your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <PasswordInput
                      autoComplete="new-password"
                      placeholder="Minimum 8 characters"
                      {...field}
                    />
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
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <PasswordInput
                      autoComplete="new-password"
                      placeholder="Re-enter new password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <LoadingButton type="submit" className="w-full cursor-pointer" loading={submitting}>
              Reset password
            </LoadingButton>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
