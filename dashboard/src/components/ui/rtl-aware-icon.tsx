"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useIsRTL } from "@/lib/rtl";

export type RTLAwareIconProps = {
  children: React.ReactNode;
  shouldFlip?: boolean;
  flipOnRTL?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

/**
 * RTL-aware icon wrapper that automatically flips icons when needed
 */
export const RTLAwareIcon = ({
  ref,
  children,
  shouldFlip = false,
  flipOnRTL = false,
  className,
  ...props
}: RTLAwareIconProps & { ref?: React.RefObject<HTMLDivElement | null> }) => {
  const isRTL = useIsRTL();

  const shouldApplyFlip = shouldFlip || (flipOnRTL && isRTL);

  return (
    <div
      ref={ref}
      className={cn("inline-flex", shouldApplyFlip && "scale-x-[-1]", className)}
      {...props}
    >
      {children}
    </div>
  );
};

RTLAwareIcon.displayName = "RTLAwareIcon";
