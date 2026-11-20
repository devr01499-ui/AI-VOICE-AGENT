/**
 * Single source of truth for URL path ⇄ page mapping.
 * Used for the first render, browser back/forward, and navigation, so the three
 * can never disagree (they used to be three hand-copied maps).
 */

export type Page =
  | "home"
  | "solutions"
  | "how-it-works"
  | "voices"
  | "pricing"
  | "blog"
  | "blog-rto"
  | "blog-healthcare"
  | "blog-fintech"
  | "dashboard"
  | "docs"
  | "privacy"
  | "terms"
  | "security"
  | "faq"
  | "contact"
  | "voice-ai-index"
  | "ai-voice-agent-software"
  | "use-cases"
  | "industries"
  | "compare"
  | "numbers_buy"
  | "not-found";

import { ALL_TOPICS } from "../data/voiceAiTopics";

/** Industry pages that exist under /use-cases/:id (pages/UseCases.tsx USE_CASE_TOPICS). */
export const USE_CASE_IDS = ["healthcare", "finance", "ecommerce", "realestate", "insurance", "logistics", "bpo", "saas"] as const;
const TOPIC_IDS = new Set(ALL_TOPICS.map((t) => t.id));

/** Exact path → page. */
const EXACT_PATHS: Record<string, Page> = {
  "/": "home",
  "/pricing": "pricing",
  "/how-it-works": "how-it-works",
  "/dashboard": "dashboard",
  "/compliance": "dashboard",
  "/settings": "dashboard",
  "/login": "dashboard",
  "/signup": "dashboard",
  "/register": "dashboard",
  "/auth": "dashboard",
  "/auth/callback": "dashboard",
  "/confirm": "dashboard",
  "/faq": "faq",
  "/contact": "contact",
  "/solutions": "solutions",
  "/compare": "solutions",
  "/voices": "voices",
  "/docs": "docs",
  "/privacy": "privacy",
  "/terms": "terms",
  "/security": "security",
  "/voice-ai-index": "voice-ai-index",
  "/ai-voice-agent-software": "ai-voice-agent-software",
  "/blog": "blog",
  "/blog/how-to-reduce-cod-rto": "blog-rto",
  "/blog/healthcare-ai-calling": "blog-healthcare",
  "/blog/fintech-collections-ai": "blog-fintech",
};

/** Path prefixes that belong to the app/auth area (rendered behind the auth gate). */
const APP_PREFIXES = ["/dashboard", "/compliance", "/settings", "/login", "/signup", "/register", "/auth", "/confirm"];

export interface ResolvedRoute {
  page: Page;
  /** Industry slug for /use-cases/:id or /industries/:id, otherwise null. */
  industryId: string | null;
  /** Topic slug for /voice-ai-index/:id, otherwise null. */
  topicId: string | null;
}

/**
 * Resolves any pathname to the page that must render for it. Unknown paths, industries and topics
 * get a "Page not found" page (noindex) — they used to show the home page or the first industry,
 * a "soft 404" for search engines (audit #125).
 */
export function resolveRoute(pathname: string): ResolvedRoute {
  const path = pathname.replace(/\/+$/, "") || "/";
  const none = { industryId: null, topicId: null };

  if (path.startsWith("/use-cases") || path.startsWith("/industries")) {
    const match = path.match(/\/(?:use-cases|industries)\/([^/]+)/);
    if (match && !(USE_CASE_IDS as readonly string[]).includes(match[1])) return { page: "not-found", ...none };
    return { page: "use-cases", industryId: match ? match[1] : null, topicId: null };
  }
  if (EXACT_PATHS[path]) return { page: EXACT_PATHS[path], ...none };
  if (APP_PREFIXES.some((prefix) => path.startsWith(prefix))) return { page: "dashboard", ...none };
  if (path.startsWith("/blog/how-to-reduce-cod-rto")) return { page: "blog-rto", ...none };
  if (path.startsWith("/voice-ai-index")) {
    const topic = path.startsWith("/voice-ai-index/") ? path.replace("/voice-ai-index/", "") : null;
    if (topic !== null && !TOPIC_IDS.has(topic)) return { page: "not-found", ...none };
    return {
      page: "voice-ai-index",
      industryId: null,
      topicId: path.startsWith("/voice-ai-index/") ? path.replace("/voice-ai-index/", "") : null,
    };
  }
  return { page: "not-found", ...none };
}

/** The canonical URL path for a page (used when navigating inside the app). */
export function pathForPage(page: Page, extraId?: string): string {
  switch (page) {
    case "home": return "/";
    case "industries":
    case "use-cases": return extraId ? `/use-cases/${extraId}` : "/use-cases";
    case "blog-rto": return "/blog/how-to-reduce-cod-rto";
    case "blog-healthcare": return "/blog/healthcare-ai-calling";
    case "blog-fintech": return "/blog/fintech-collections-ai";
    case "numbers_buy": return "/dashboard";
    case "not-found": return typeof window !== "undefined" ? window.location.pathname : "/";
    default: return `/${page}`;
  }
}
