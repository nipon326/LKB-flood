"use client";

import { useEffect } from "react";

const REFRESH_MS = 5 * 60 * 1000;

export default function AutoRefresh() {
  useEffect(() => {
    const timer = setInterval(() => {
      window.location.reload();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  return null;
}
