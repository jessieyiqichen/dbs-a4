import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { preload } from "react-dom";
import { Notifier } from "@/components/Notifier";
import { clerkAppearance } from "@/lib/auth/appearance";
import { clerkLocalization } from "@/lib/auth/copy";
import { SIGN_IN_PATH, SIGN_UP_PATH } from "@/lib/auth/routes";
import "./globals.css";

// Fredoka for headings and Nunito for text, as in the A2 Trail Quest design system: round and friendly.
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"], weight: ["500", "600", "700"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["400", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Nudge",
  description: "Turns the thing you keep putting off into today's number, and nudges you until you start",
};

// The week's shelf is fixed at the foot of a phone screen, so the page reaches into the home-indicator area and pads for it
export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Titi's sitting loop is the first picture on every first visit; fetched early so she is not a blank circle for a moment
  // (first-run check, 2026-10-18)
  preload("/cat/idle.webp", { as: "image" });
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ClerkProvider
          appearance={clerkAppearance}
          localization={clerkLocalization}
          signInUrl={SIGN_IN_PATH}
          signUpUrl={SIGN_UP_PATH}
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
        >
          {children}
          <Notifier />
        </ClerkProvider>
      </body>
    </html>
  );
}
