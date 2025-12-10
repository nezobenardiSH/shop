"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { getContentGroup } from "@/lib/useContentGroup";

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

type UserType = "merchant" | "internal_team" | "anonymous";

export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [userType, setUserType] = useState<UserType>("anonymous");
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isMerchantDataReady, setIsMerchantDataReady] = useState(false);
  const lastTrackedPath = useRef<string | null>(null);

  const isProduction = typeof window !== "undefined" &&
    !window.location.hostname.includes("localhost") &&
    !window.location.hostname.includes("127.0.0.1");

  // Check if current page needs to wait for merchant data to load
  // This includes /merchant/* pages and /login/[merchantId] pages
  const isMerchantPage =
    pathname?.startsWith("/merchant/") ||
    pathname?.startsWith("/login/")
    ? true : false;

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

  // For merchant pages, wait for page title to change from default
  // This indicates merchant data has loaded
  useEffect(() => {
    if (!isMerchantPage) {
      setIsMerchantDataReady(true);
      return;
    }

    // Reset when navigating to a new merchant page
    setIsMerchantDataReady(false);

    // Default titles before merchant data loads
    const defaultTitles = [
      "Merchant Onboarding Portal",
      "Merchant Login - Onboarding Portal",
    ];

    // Check if title has already changed to merchant-specific
    if (!defaultTitles.includes(document.title)) {
      setIsMerchantDataReady(true);
      return;
    }

    // Poll for title change (merchant data loaded)
    const checkTitle = setInterval(() => {
      if (!defaultTitles.includes(document.title)) {
        setIsMerchantDataReady(true);
        clearInterval(checkTitle);
      }
    }, 100);

    // Timeout after 5 seconds to avoid infinite polling
    const timeout = setTimeout(() => {
      clearInterval(checkTitle);
      setIsMerchantDataReady(true);
    }, 5000);

    return () => {
      clearInterval(checkTitle);
      clearTimeout(timeout);
    };
  }, [pathname, isMerchantPage]);

  // Track page views with content group and user type
  useEffect(() => {
    const currentPath = `${pathname}?${searchParams?.toString() ?? ""}`;
    const isReady = isAuthChecked && isMerchantDataReady;

    if (
      isProduction &&
      gaId &&
      isReady &&
      typeof window.gtag === "function" &&
      lastTrackedPath.current !== currentPath
    ) {
      const contentGroup = getContentGroup(pathname, searchParams);
      window.gtag("event", "page_view", {
        content_group: contentGroup,
        user_type: userType,
      });
      lastTrackedPath.current = currentPath;
    }
  }, [pathname, searchParams, gaId, isProduction, userType, isAuthChecked, isMerchantDataReady]);

  if (!isProduction || !gaId) {
    return null;
  }

  // Load GA4 script manually without automatic page_view tracking
  // We handle page_view events ourselves with proper timing
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${gaId}', {
            send_page_view: false
          });
        `}
      </Script>
    </>
  );
}
