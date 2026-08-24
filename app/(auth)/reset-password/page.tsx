import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset password",
};

// The link in the email points at GET /api/auth/reset-password/:token
// (better-auth's own route, not this page) — it validates the token
// server-side, then redirects here with either ?token=<verified-token>
// or ?error=INVALID_TOKEN attached. This page never sees the raw
// unverified token from the email at all, only the outcome of that check.
export default async function ResetPassword(props: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const searchParams = await props.searchParams;
  const token = searchParams.token;

  if (!token || searchParams.error) {
    return (
      <main className="flex min-h-svh items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Link expired or invalid</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              This password reset link is no longer valid — it may have already been used, or it&apos;s
              expired (links are valid for 1 hour). Request a new one below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              Request a new reset link
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <ResetPasswordForm token={token} />
    </main>
  );
}
