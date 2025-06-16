/**
 * RTL/LTR utility functions and helpers
 */
import { useLocale } from "next-intl";

export function useDirection() {
  const locale = useLocale();
  return locale === "fa" ? "rtl" : "ltr";
}

export function useIsRTL() {
  const direction = useDirection();
  return direction === "rtl";
}

/**
 * Convert logical properties to physical properties based on direction
 */
export function getDirectionalClass(
  ltrClass: string,
  rtlClass: string,
  direction?: "ltr" | "rtl",
): string {
  if (!direction) {
    // Return both with direction prefixes
    return `ltr:${ltrClass} rtl:${rtlClass}`;
  }
  return direction === "rtl" ? rtlClass : ltrClass;
}

/**
 * Get margin/padding start class
 */
export function getStartClass(value: string, direction?: "ltr" | "rtl"): string {
  if (!direction) {
    return `ms-${value}`;
  }
  return direction === "rtl" ? `mr-${value}` : `ml-${value}`;
}

/**
 * Get margin/padding end class
 */
export function getEndClass(value: string, direction?: "ltr" | "rtl"): string {
  if (!direction) {
    return `me-${value}`;
  }
  return direction === "rtl" ? `ml-${value}` : `mr-${value}`;
}

/**
 * Icon orientation for RTL
 */
export function getIconOrientation(shouldFlip: boolean = false): string {
  return shouldFlip ? "rtl:scale-x-[-1]" : "";
}

/**
 * Text alignment utilities
 */
export function getTextAlignment(alignment: "start" | "end" | "center"): string {
  switch (alignment) {
    case "start":
      return "text-start";
    case "end":
      return "text-end";
    case "center":
      return "text-center";
    default:
      return "text-start";
  }
}
