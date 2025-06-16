"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type PerformanceGaugeProps = {
  label: string;
  value: number;
  max: number;
  unit?: string;
  color?: "blue" | "green" | "red" | "yellow" | "purple";
  size?: "sm" | "md" | "lg";
};

export function PerformanceGauge({
  label,
  value,
  max,
  unit = "",
  color = "blue",
  size = "md",
}: PerformanceGaugeProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const _getColorClasses = (color: string, percentage: number) => {
    const intensity = percentage > 80 ? 600 : percentage > 50 ? 500 : 400;

    switch (color) {
      case "blue":
        return `text-blue-${intensity}`;
      case "green":
        return `text-green-${intensity}`;
      case "red":
        return `text-red-${intensity}`;
      case "yellow":
        return `text-yellow-${intensity}`;
      case "purple":
        return `text-purple-${intensity}`;
      default:
        return `text-blue-${intensity}`;
    }
  };

  const getSizeClasses = (size: string) => {
    switch (size) {
      case "sm":
        return "text-lg";
      case "md":
        return "text-xl";
      case "lg":
        return "text-2xl";
      default:
        return "text-xl";
    }
  };

  const getStatusColor = (percentage: number) => {
    if (color === "red") {
      // For error rates, red is bad
      if (percentage > 5) return "text-red-600";
      if (percentage > 2) return "text-yellow-600";
      return "text-green-600";
    } else {
      // For CPU/Memory, high values are concerning
      if (percentage > 90) return "text-red-600";
      if (percentage > 80) return "text-yellow-600";
      if (percentage > 60) return "text-blue-600";
      return "text-green-600";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={cn("font-bold", getSizeClasses(size), getStatusColor(percentage))}>
          {value.toFixed(1)}
          {unit}
        </span>
      </div>

      <div className="space-y-1">
        <Progress
          value={percentage}
          className={cn("h-2", size === "sm" && "h-1", size === "lg" && "h-3")}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>0{unit}</span>
          <span>
            {max}
            {unit}
          </span>
        </div>
      </div>

      {/* Status indicator */}
      <div className="flex items-center space-x-1">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            percentage > 90
              ? "bg-red-500"
              : percentage > 80
                ? "bg-yellow-500"
                : percentage > 60
                  ? "bg-blue-500"
                  : "bg-green-500",
          )}
        />
        <span className="text-xs text-muted-foreground">
          {percentage > 90
            ? "Critical"
            : percentage > 80
              ? "High"
              : percentage > 60
                ? "Moderate"
                : "Normal"}
        </span>
      </div>
    </div>
  );
}
