import { buttonClass } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

/** A small action inside the form ("Forgot password?", "Resend", "Back"): the app's ghost button, an underlined word with
 *  a full-size tap area */
const LINK = buttonClass({ variant: "ghost", className: "min-h-11 px-1 normal-case" });
/** Same as the error under our own fields (Field.tsx) */
const ERROR_TEXT = "text-sm font-semibold text-danger";

/** Clerk's sign-in and sign-up boxes in Fish Treat (user, 2026-10-25). Clerk works out its shades from real colours, so
 *  these repeat the tokens in globals.css; change both together. Its styles sit in the `clerk` CSS layer, under
 *  Tailwind's utilities, so the classes below win. */
export const clerkAppearance = {
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "#3ec66b", // --color-primary
    colorPrimaryForeground: "#2f2a24", // --color-on-primary, 6.4:1 on the green
    colorForeground: "#2f2a24", // --color-ink
    colorMutedForeground: "#6b6256", // --color-muted
    colorBackground: "#fff8ea", // --color-page: the form sits on the page, with no card of its own
    colorInput: "#ffffff", // --color-surface
    colorInputForeground: "#2f2a24",
    colorBorder: "#8f8068", // --color-line, 3:1 for control edges
    colorDanger: "#9c2a6b", // --color-danger
    colorRing: "#2f2a24", // --color-focus
    fontFamily: "var(--font-nunito), system-ui, sans-serif",
    fontFamilyButtons: "var(--font-fredoka), var(--font-nunito), system-ui, sans-serif",
    borderRadius: "1rem",
  },
  // Read-only things have no box (AGENTS.md), so Clerk's card, its shadow and its grey footer band are taken away.
  // Clerk's box hides what sticks out, and the fields reach its edges, so it would cut the sides off the focus ring and
  // the clay buttons' shadows (user, 2026-10-26)
  elements: {
    rootBox: "w-full",
    cardBox: "w-full overflow-visible border-0 bg-transparent shadow-none",
    card: "border-0 bg-transparent px-0 py-2 shadow-none",
    footer: "bg-none bg-transparent",
    headerTitle: "font-display text-2xl font-bold text-ink lg:text-3xl",
    headerSubtitle: "font-bold text-muted",
    socialButtonsBlockButton: buttonClass({ variant: "secondary", className: "w-full" }),
    formButtonPrimary: buttonClass({ variant: "primary", className: "w-full normal-case" }),
    formFieldLabel: "font-semibold text-ink",
    formFieldInput: inputClass,
    // The taller tap area of the link would sit below the line of text beside it
    footerAction: "items-center",
    footerActionText: "font-bold text-muted",
    footerActionLink: LINK,
    dividerText: "font-bold text-muted",
    formFieldHintText: "text-sm font-semibold text-muted",
    formFieldErrorText: ERROR_TEXT,
    // The screens few people see (user, 2026-10-26: the email-code option was too small to find): a wrong password,
    // "Forgot password?", picking another way to sign in, the code boxes and "Resend". Clerk draws them as small plain
    // links and thin boxes; here they take the app's own controls, so every way in is as easy to tap as the first
    formFieldAction: LINK,
    // Every Clerk button, including ones it gives no name of their own ("Email support" on Get help, 32px tall)
    button: "min-h-11",
    formResendCodeLink: `${LINK} disabled:cursor-default disabled:text-muted disabled:no-underline`,
    backLink: LINK,
    headerBackLink: LINK,
    formButtonReset: LINK,
    alternativeMethodsBlockButton: buttonClass({ variant: "secondary", className: "w-full normal-case" }),
    identityPreviewText: "font-bold text-ink",
    identityPreviewEditButton: "min-h-11 min-w-11 justify-center rounded-xl text-ink hover:bg-wash focus-visible:outline-3 focus-visible:outline-focus",
    identityPreviewEditButtonIcon: "size-5",
    formFieldInputShowPasswordButton: "min-h-11 min-w-11 text-muted hover:text-ink focus-visible:outline-3 focus-visible:outline-focus",
    otpCodeFieldInput:
      // Clerk caps the boxes at 36px (max-height) and outlines them with a thin shadow; ours match the app's inputs
      "h-14 max-h-none w-12 rounded-xl border-2 border-line bg-surface shadow-[inset_0_2px_0_rgba(0,0,0,.04)] " +
      "font-display text-2xl font-bold text-ink aria-invalid:border-danger " +
      "focus-visible:border-ink focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-focus",
    otpCodeFieldErrorText: ERROR_TEXT,
    alertText: ERROR_TEXT,
  },
} as const;
