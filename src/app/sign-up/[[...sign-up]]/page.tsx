import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth/AuthScreen";

export const metadata: Metadata = { title: "Sign up · Nudge" };

export default function SignUpPage() {
  return (
    <AuthScreen>
      <SignUp />
    </AuthScreen>
  );
}
