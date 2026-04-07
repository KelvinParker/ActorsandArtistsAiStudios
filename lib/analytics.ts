"use client";

type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

type WindowWithTrackers = Window & {
  plausible?: (eventName: string, options?: { props?: AnalyticsPayload }) => void;
  gtag?: (...args: unknown[]) => void;
  posthog?: { capture: (eventName: string, props?: AnalyticsPayload) => void };
};

/**
 * Lightweight analytics bridge:
 * - sends to common trackers when present
 * - logs in development so events are visible during testing
 */
export function trackEvent(eventName: string, payload: AnalyticsPayload = {}): void {
  if (typeof window === "undefined") return;
  const w = window as WindowWithTrackers;

  try {
    w.plausible?.(eventName, { props: payload });
    w.gtag?.("event", eventName, payload);
    w.posthog?.capture(eventName, payload);
  } catch {
    // never block user actions due to analytics issues
  }

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", eventName, payload);
  }
}
