"use client";

import { usePathname, useSearchParams } from "next/navigation";

export function getContentGroup(pathname: string, searchParams: URLSearchParams): string {
  const stage = searchParams.get("stage");
  const booking = searchParams.get("booking");
  const cancel = searchParams.get("cancel");

  // Cancellation pages (check first - most specific)
  if (cancel === "installation") {
    return "installation cancellation";
  }
  if (cancel === "training") {
    return "training cancellation";
  }

  // Booking pages (check second - more specific than stage)
  if (stage === "installation" && booking === "installation") {
    return "installation booking";
  }
  if (stage === "training" && booking === "training") {
    return "training booking";
  }

  // Login
  if (pathname.startsWith("/login")) {
    return "login";
  }

  // Merchant pages
  if (pathname.includes("/merchant/")) {
    // Specific routes
    if (pathname.endsWith("/overview")) {
      return "overview";
    }
    if (pathname.endsWith("/details")) {
      return "details";
    }

    // Stage-based content groups
    if (stage === "welcome") return "welcometostorehub";
    if (stage === "preparation") return "progress-preparation";
    if (stage === "installation") return "progress-installation";
    if (stage === "training") return "progress-training";
    if (stage === "ready-go-live") return "progress-ready go live";
    if (stage === "live") return "progress-live";
  }

  return "other";
}

export function useContentGroup(): string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return getContentGroup(pathname, searchParams);
}
