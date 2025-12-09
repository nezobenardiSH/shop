"use client";

import { GoogleAnalytics as GA } from "@next/third-parties/google";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { getContentGroup } from "@/lib/useContentGroup";

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
  }
}

export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isProduction = typeof window !== "undefined" &&
    !window.location.hostname.includes("localhost") &&
    !window.location.hostname.includes("127.0.0.1");

  useEffect(() => {
    if (isProduction && gaId && typeof window.gtag === "function") {
      const contentGroup = getContentGroup(pathname, searchParams);
      window.gtag("event", "page_view", {
        content_group: contentGroup,
      });
    }
  }, [pathname, searchParams, gaId, isProduction]);

  if (!isProduction || !gaId) {
    return null;
  }

  return <GA gaId={gaId} />;
}
