"use client";

import Clarity from "@microsoft/clarity";
import { useEffect } from "react";

interface MsClarityProps {
  merchantId?: string;
  merchantName?: string;
}

export default function MsClarity({ merchantId, merchantName }: MsClarityProps) {
  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
    const isProduction = typeof window !== "undefined" &&
      !window.location.hostname.includes("localhost") &&
      !window.location.hostname.includes("127.0.0.1");

    if (isProduction && projectId) {
      Clarity.init(projectId);

      // Link session to merchant if available
      if (merchantId) {
        Clarity.identify(merchantId, undefined, undefined, merchantName);
        Clarity.setTag("merchantId", merchantId);
        if (merchantName) {
          Clarity.setTag("merchantName", merchantName);
        }
      }
    }
  }, [merchantId, merchantName]);

  return null;
}
