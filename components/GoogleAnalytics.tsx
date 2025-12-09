"use client";

import { GoogleAnalytics as GA } from "@next/third-parties/google";

export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const isProduction = typeof window !== "undefined" &&
    !window.location.hostname.includes("localhost") &&
    !window.location.hostname.includes("127.0.0.1");

  if (!isProduction || !gaId) {
    return null;
  }

  return <GA gaId={gaId} />;
}
