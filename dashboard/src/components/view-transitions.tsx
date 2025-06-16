"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

declare global {
  type Document = {
    startViewTransition?: (callback: () => void) => {
      ready: Promise<void>;
      updateCallbackDone: Promise<void>;
      finished: Promise<void>;
    };
  };
}

type ViewTransitionsProps = {
  children: React.ReactNode;
};

export function ViewTransitions({ children }: ViewTransitionsProps) {
  const pathname = usePathname();
  useRouter();
  const previousPathname = useRef(pathname);
  const isTransitioning = useRef(false);

  useEffect(() => {
    // Check if the browser supports View Transitions API
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      const handleViewTransition = () => {
        if (previousPathname.current !== pathname && !isTransitioning.current) {
          isTransitioning.current = true;

          document.startViewTransition!(() => {
            previousPathname.current = pathname;
            isTransitioning.current = false;
          });
        }
      };

      handleViewTransition();
    }
  }, [pathname]);

  useEffect(() => {
    // Enhanced CSS transitions with RTL support
    const style = document.createElement("style");
    style.textContent = `
      /* View Transitions API styles */
      ::view-transition-old(root),
      ::view-transition-new(root) {
        animation-duration: 0.4s;
        animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
      }

      ::view-transition-old(root) {
        animation-name: slide-out-ltr;
      }

      ::view-transition-new(root) {
        animation-name: slide-in-ltr;
      }

      /* LTR Animations */
      @keyframes slide-out-ltr {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(-30px);
          opacity: 0;
        }
      }

      @keyframes slide-in-ltr {
        from {
          transform: translateX(30px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      /* RTL specific animations */
      [dir="rtl"] ::view-transition-old(root) {
        animation-name: slide-out-rtl;
      }

      [dir="rtl"] ::view-transition-new(root) {
        animation-name: slide-in-rtl;
      }

      @keyframes slide-out-rtl {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(30px);
          opacity: 0;
        }
      }

      @keyframes slide-in-rtl {
        from {
          transform: translateX(-30px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      /* Fallback transition styles for browsers without View Transitions API */
      .page-transition {
        transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
      }
      
      .page-transition-enter {
        opacity: 0;
        transform: translateY(20px);
      }
      
      .page-transition-enter-active {
        opacity: 1;
        transform: translateY(0);
      }
      
      .page-transition-exit {
        opacity: 1;
        transform: translateY(0);
      }
      
      .page-transition-exit-active {
        opacity: 0;
        transform: translateY(-20px);
      }

      /* Enhanced RTL support */
      [dir="rtl"] .page-transition-enter {
        transform: translateX(-20px) translateY(10px);
      }

      [dir="rtl"] .page-transition-exit-active {
        transform: translateX(20px) translateY(-10px);
      }

      /* Smooth scroll behavior */
      html {
        scroll-behavior: smooth;
      }

      /* Enhanced focus management for RTL */
      [dir="rtl"] {
        text-align: right;
      }

      [dir="rtl"] .flex {
        flex-direction: row-reverse;
      }

      [dir="rtl"] .space-x-reverse > :not([hidden]) ~ :not([hidden]) {
        --tw-space-x-reverse: 1;
      }

      /* Reduce motion for accessibility */
      @media (prefers-reduced-motion: reduce) {
        ::view-transition-old(root),
        ::view-transition-new(root),
        .page-transition,
        .page-transition-enter,
        .page-transition-enter-active,
        .page-transition-exit,
        .page-transition-exit-active {
          animation: none !important;
          transition: none !important;
          transform: none !important;
        }
        
        html {
          scroll-behavior: auto;
        }
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        ::view-transition-old(root),
        ::view-transition-new(root) {
          animation-duration: 0.1s;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  return <div className="page-transition page-transition-enter-active">{children}</div>;
}
