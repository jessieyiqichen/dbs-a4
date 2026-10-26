/** What Titi says on the sign-in and sign-up pages: what Nudge is, in one line (user, 2026-10-25). */
export const AUTH_INTRO = "Hi, I'm Titi! I turn your big job-search goal into today's number and cheer you on";

/** Clerk's own lines, rewritten to the house style: no full stops, errors say what to do next and take no "!"
 *  (copy.test.ts). Clerk's English file leaves its error lines blank and shows the server's wording instead ("Password
 *  is incorrect. Try again, or use another method."), so the errors a person can meet while signing in or up with an
 *  email, a password, a code or Google are written out here (user, 2026-10-26: cover the edge cases too). */
export const clerkLocalization = {
  signIn: {
    start: { subtitle: "Good to see you again!" },
    alternativeMethods: {
      subtitle: "Pick another way to sign in",
      getHelp: { content: "Can't get in? Email us and we'll help you back into your account" },
    },
    resetPassword: {
      successMessage: "Your new password is set! Signing you in now",
      requiredMessage: "To keep your account safe, set a new password",
    },
    noAvailableMethods: { message: "This account has no way to sign in yet, try another email" },
  },
  signUp: {
    start: { subtitle: "It's free and takes a minute", subtitleCombined: "It's free and takes a minute" },
    continue: { subtitle: "Just a few more details and you're in" },
  },
  formFieldError__matchingPasswords: "Passwords match",
  formFieldError__notMatchingPasswords: "The passwords don't match, type the same one twice",
  formFieldError__verificationLinkExpired: "That link expired, ask for a new one",
  unstable__errors: {
    form_identifier_not_found: "No account with that email yet, check it or sign up",
    form_password_incorrect: "That password isn't right, try again or use another method",
    form_password_or_identifier_incorrect: "That email or password isn't right, try again",
    form_code_incorrect: "That code isn't right, check the email we sent and try again",
    form_identifier_exists__email_address: "That email already has an account, sign in instead",
    form_param_format_invalid__email_address: "Enter an email address, like you@example.com",
    form_param_nil: "Fill this in to continue",
    form_password_length_too_short: "Use at least 8 characters",
    form_password_not_strong_enough: "Make your password a little stronger, add a few more characters",
    form_password_matches_identifier: "Use a password that isn't your email address",
    form_new_password_matches_current: "Pick a password you haven't used here before",
    form_password_pwned: "This password showed up in a data leak, pick a different one",
    form_password_pwned__sign_in: "This password showed up in a data leak, reset it to sign in",
    form_password_compromised__sign_in: "To keep your account safe, sign in another way, then set a new password",
    form_password_untrusted__sign_in: "To keep your account safe, sign in another way, then set a new password",
    // Not in Clerk's typed list, but its errors are looked up by code; seen 2026-10-26 after a code screen sat open
    verification_expired: "That code expired, tap Resend for a new one",
    too_many_unverified_identifications: "Too many codes are waiting, try again in a few minutes",
    session_exists: "You're already signed in",
    not_allowed_access: "This email can't sign up here, try another one",
  },
};
