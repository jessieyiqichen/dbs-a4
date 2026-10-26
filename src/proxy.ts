import { clerkMiddleware } from "@clerk/nextjs/server";
import { isPublicPath, SIGN_IN_PATH, SIGN_UP_PATH } from "@/lib/auth/routes";

/** Runs before every page: a signed-out visitor is sent to sign in before any page that shows a person's goals.
 *  This only decides who may open a page; once goals live in Supabase (step 5), row-level security decides whose rows
 *  anyone gets, so hiding a page is never the only lock. */
export default clerkMiddleware(
  async (auth, request) => {
    if (!isPublicPath(request.nextUrl.pathname)) await auth.protect();
  },
  { signInUrl: SIGN_IN_PATH, signUpUrl: SIGN_UP_PATH },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
