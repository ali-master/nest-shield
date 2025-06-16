import { Suspense } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { LazyComponent } from "@/components/lazy-load";
import { LoadingSkeleton } from "@/components/ui/loading";

// PPR will be enabled when Next.js canary is used
// export const experimental_ppr = true;

// Static metadata for SEO
export const metadata = {
  title: "Dashboard - NestShield",
  description: "Real-time monitoring and protection dashboard for your NestJS applications.",
  openGraph: {
    title: "NestShield Dashboard",
    description: "Monitor your API protection in real-time",
    type: "website",
  },
};

// Lazy load the dashboard component for better performance
const LazyRealtimeDashboard = () =>
  import("@/components/realtime/real-time-dashboard").then((mod) => ({
    default: mod.RealtimeDashboard,
  }));

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<LoadingSkeleton variant="dashboard" />}>
        <LazyComponent
          loader={LazyRealtimeDashboard}
          websocketUrl={process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:3000"}
          fallback={<LoadingSkeleton variant="dashboard" />}
        />
      </Suspense>
    </DashboardLayout>
  );
}
