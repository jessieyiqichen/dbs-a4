import { buttonClass } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

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
  elements: {
    rootBox: "w-full",
    cardBox: "w-full border-0 bg-transparent shadow-none",
    card: "border-0 bg-transparent px-0 py-2 shadow-none",
    footer: "bg-none bg-transparent",
    headerTitle: "font-display text-2xl font-bold text-ink lg:text-3xl",
    headerSubtitle: "font-bold text-muted",
    socialButtonsBlockButton: buttonClass({ variant: "secondary", className: "w-full" }),
    formButtonPrimary: buttonClass({ variant: "primary", className: "w-full normal-case" }),
    formFieldLabel: "font-semibold text-ink",
    formFieldInput: inputClass,
    footerActionText: "font-bold text-muted",
    footerActionLink:
      "font-bold text-ink underline decoration-2 underline-offset-4 decoration-line hover:text-ink hover:decoration-ink",
  },
} as const;
