"use client";

import { GoogleAnalytics as GA } from "@next/third-parties/google";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getContentGroup } from "@/lib/useContentGroup";

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
  }
}

type UserType = "merchant" | "internal_team" | "anonymous";

export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [userType, setUserType] = useState<UserType>("anonymous");
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  const isProduction = typeof window !== "undefined" &&
    !window.location.hostname.includes("localhost") &&
    !window.location.hostname.includes("127.0.0.1");

  // Fetch user type on mount and when pathname changes
  useEffect(() => {
    async function fetchUserType() {
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setUserType(data.user.userType || "merchant");
          }
        }
      } catch {
        // User not logged in, keep as anonymous
      } finally {
        setIsAuthChecked(true);
      }
    }

    if (isProduction) {
      fetchUserType();
    } else {
      setIsAuthChecked(true);
    }
  }, [pathname, isProduction]);

  // Track page views with content group and user type
  useEffect(() => {
    if (isProduction && gaId && isAuthChecked && typeof window.gtag === "function") {
      const contentGroup = getContentGroup(pathname, searchParams);
      window.gtag("event", "page_view", {
        content_group: contentGroup,
        user_type: userType,
      });
    }
  }, [pathname, searchParams, gaId, isProduction, userType, isAuthChecked]);

  if (!isProduction || !gaId) {
    return null;
  }

  return <GA gaId={gaId} />;
}
