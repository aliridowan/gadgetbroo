import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default function ForgotPassword() {
  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <ForgotPasswordForm />
    </main>
  );
}
