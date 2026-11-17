/**
 * What an auth email link or OAuth redirect told us when the page loaded.
 *
 * Supabase reads the URL hash and then removes it, asynchronously. Components that
 * mount later can no longer see it, so it is captured once here, synchronously, at
 * module load. Import this module before the Supabase client is used (main.tsx does).
 */

export interface AuthRedirectInfo {
  /** The visitor arrived from a "reset your password" email link. */
  isRecovery: boolean;
  /** A friendly message when the link or OAuth sign-in failed, otherwise null. */
  errorMessage: string | null;
  /** True when the failed link was an expired or already-used email link. */
  linkExpired: boolean;
}

function parse(): AuthRedirectInfo {
  const empty: AuthRedirectInfo = { isRecovery: false, errorMessage: null, linkExpired: false };
  if (typeof window === "undefined") return empty;

  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  for (const [key, value] of new URLSearchParams(hash)) {
    if (!params.has(key)) params.set(key, value);
  }

  const isRecovery = params.get("type") === "recovery";
  const errorCode = params.get("error_code") || "";
  const error = params.get("error") || "";
  if (!error && !errorCode) return { ...empty, isRecovery };

  const linkExpired = errorCode === "otp_expired" || /expired|invalid/i.test(params.get("error_description") || "");
  let errorMessage: string;
  if (linkExpired) {
    errorMessage = "This link has expired or was already used. Request a new one below.";
  } else if (error === "access_denied") {
    errorMessage = "Sign-in was cancelled or not permitted. Please try again.";
  } else {
    errorMessage = "We could not complete sign-in from that link. Please try again.";
  }
  return { isRecovery: false, errorMessage, linkExpired };
}

export const initialAuthRedirect: AuthRedirectInfo = parse();
