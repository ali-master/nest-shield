import { Suspense } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { LoadingSkeleton } from "@/components/ui/loading";
import { RealtimeDashboard } from "@/components/realtime/real-time-dashboard";

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

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<LoadingSkeleton variant="dashboard" />}>
        <RealtimeDashboard
          websocketUrl={process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:3000"}
        />
      </Suspense>
    </DashboardLayout>
  );
}
