"use client";

import { useEffect } from "react";

type PerformanceMetric = {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta?: number;
};

// Web Vitals thresholds
const THRESHOLDS = {
  CLS: { good: 0.1, poor: 0.25 },
  FID: { good: 100, poor: 300 },
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
};

function getRating(name: string, value: number): "good" | "needs-improvement" | "poor" {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return "good";

  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

function sendToAnalytics(metric: PerformanceMetric) {
  // Send to your analytics service
  if (process.env.NODE_ENV === "production") {
    // Example: Google Analytics 4
    if (typeof gtag !== "undefined") {
      gtag("event", metric.name, {
        value: Math.round(metric.value),
        metric_rating: metric.rating,
        custom_parameter_1: metric.delta,
      });
    }

    // Example: Send to custom analytics endpoint
    fetch("/api/analytics/web-vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metric),
    }).catch(() => {
      // Silently fail to avoid affecting user experience
    });
  }

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.log("📊 Web Vital:", metric);
  }
}

export function PerformanceMonitor() {
  useEffect(() => {
    // Check if the browser supports the Performance Observer API
    if (typeof window === "undefined" || !("PerformanceObserver" in window)) {
      return;
    }

    // Observe Core Web Vitals
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Largest Contentful Paint (LCP)
        if (entry.entryType === "largest-contentful-paint") {
          const metric: PerformanceMetric = {
            name: "LCP",
            value: entry.startTime,
            rating: getRating("LCP", entry.startTime),
          };
          sendToAnalytics(metric);
        }

        // First Input Delay (FID)
        if (entry.entryType === "first-input" && "processingStart" in entry) {
          const metric: PerformanceMetric = {
            name: "FID",
            value: entry.processingStart - entry.startTime,
            rating: getRating("FID", entry.processingStart - entry.startTime),
          };
          sendToAnalytics(metric);
        }

        // Cumulative Layout Shift (CLS)
        if (entry.entryType === "layout-shift" && !(entry as any).hadRecentInput) {
          const metric: PerformanceMetric = {
            name: "CLS",
            value: (entry as any).value,
            rating: getRating("CLS", (entry as any).value),
          };
          sendToAnalytics(metric);
        }
      }
    });

    // Start observing
    try {
      observer.observe({ entryTypes: ["largest-contentful-paint", "first-input", "layout-shift"] });
    } catch {
      console.warn("Performance Observer not supported for some entry types");
    }

    // Observe navigation timing
    const navigationObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "navigation") {
          const navEntry = entry as PerformanceNavigationTiming;

          // Time to First Byte (TTFB)
          const ttfb = navEntry.responseStart - navEntry.requestStart;
          sendToAnalytics({
            name: "TTFB",
            value: ttfb,
            rating: getRating("TTFB", ttfb),
          });

          // First Contentful Paint (FCP)
          if ("loadEventEnd" in navEntry && navEntry.loadEventEnd > 0) {
            const fcp = navEntry.loadEventEnd - navEntry.fetchStart;
            sendToAnalytics({
              name: "FCP",
              value: fcp,
              rating: getRating("FCP", fcp),
            });
          }
        }
      }
    });

    try {
      navigationObserver.observe({ entryTypes: ["navigation"] });
    } catch {
      console.warn("Navigation timing not supported");
    }

    // Monitor long tasks
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          // Tasks longer than 50ms
          sendToAnalytics({
            name: "Long Task",
            value: entry.duration,
            rating: "poor",
          });
        }
      }
    });

    try {
      longTaskObserver.observe({ entryTypes: ["longtask"] });
    } catch {
      console.warn("Long task monitoring not supported");
    }

    // Cleanup observers
    return () => {
      observer.disconnect();
      navigationObserver.disconnect();
      longTaskObserver.disconnect();
    };
  }, []);

  // @ts-ignore
  useEffect(() => {
    // Monitor route changes for SPA metrics
    const handleRouteChange = () => {
      const now = performance.now();
      sendToAnalytics({
        name: "Route Change",
        value: now,
        rating: "good",
      });
    };

    // Listen for Next.js route changes
    if (typeof window !== "undefined") {
      const originalPushState = window.history.pushState;
      const originalReplaceState = window.history.replaceState;

      window.history.pushState = function (...args) {
        originalPushState.apply(this, args);
        handleRouteChange();
      };

      window.history.replaceState = function (...args) {
        originalReplaceState.apply(this, args);
        handleRouteChange();
      };

      window.addEventListener("popstate", handleRouteChange);

      return () => {
        window.history.pushState = originalPushState;
        window.history.replaceState = originalReplaceState;
        window.removeEventListener("popstate", handleRouteChange);
      };
    }
  }, []);

  // Monitor resource loading performance
  useEffect(() => {
    if (typeof window === "undefined") return;

    const resourceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resource = entry as PerformanceResourceTiming;

        // Monitor slow resources
        if (resource.duration > 1000) {
          // Resources taking more than 1s
          sendToAnalytics({
            name: "Slow Resource",
            value: resource.duration,
            rating: "poor",
          });
        }
      }
    });

    try {
      resourceObserver.observe({ entryTypes: ["resource"] });
    } catch {
      console.warn("Resource timing not supported");
    }

    return () => {
      resourceObserver.disconnect();
    };
  }, []);

  // This component doesn't render anything
  return null;
}
