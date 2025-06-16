"use client";

import type { ComponentType, ReactNode } from "react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type LazyLoadProps = {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
};

type LazyComponentWrapperProps = {
  loader: () => Promise<{ default: ComponentType<any> }>;
  fallback?: ReactNode;
  [key: string]: any;
};

// Generic lazy loading wrapper
export function LazyLoad({ children, fallback, className }: LazyLoadProps) {
  const defaultFallback = (
    <div className={className}>
      <Skeleton className="h-full w-full" />
    </div>
  );

  return <Suspense fallback={fallback || defaultFallback}>{children}</Suspense>;
}

// Component-specific lazy loader
export function LazyComponent({ loader, fallback, ...props }: LazyComponentWrapperProps) {
  const Component = lazy(loader);

  const defaultFallback = (
    <div className="flex items-center justify-center p-8">
      <div className="space-y-4 w-full max-w-sm">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );

  return (
    <Suspense fallback={fallback || defaultFallback}>
      <Component {...props} />
    </Suspense>
  );
}

// Intersection Observer hook for lazy loading
export function useLazyLoad(threshold = 0.1) {
  const targetRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    const currentTarget = targetRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [threshold]);

  return { targetRef, isVisible };
}

// Lazy image component with intersection observer
export function LazyImage({
  src,
  alt,
  className = "",
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const { targetRef, isVisible } = useLazyLoad();
  const [loaded, setLoaded] = useState(false);

  return (
    <div ref={targetRef} className={`relative ${className}`}>
      {!loaded && <Skeleton className="absolute inset-0 w-full h-full" />}
      {isVisible && (
        <img
          src={src}
          alt={alt}
          className={`transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          } ${className}`}
          onLoad={() => setLoaded(true)}
          loading="lazy"
          {...props}
        />
      )}
    </div>
  );
}

// Lazy section component
export function LazySection({
  children,
  className = "",
  threshold = 0.1,
  fallback,
}: {
  children: ReactNode;
  className?: string;
  threshold?: number;
  fallback?: ReactNode;
}) {
  const { targetRef, isVisible } = useLazyLoad(threshold);

  return (
    <div ref={targetRef} className={className}>
      {isVisible ? children : fallback || <Skeleton className="h-32 w-full" />}
    </div>
  );
}
