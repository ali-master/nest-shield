import { Suspense } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { LazyComponent } from "@/components/lazy-load";
import { LoadingSkeleton } from "@/components/ui/loading";

// PPR will be enabled when Next.js canary is used
// export const experimental_ppr = true;

// Static metadata
export const metadata = {
  title: "Configuration - NestShield",
  description: "Configure your NestJS application protection settings and rules.",
  openGraph: {
    title: "NestShield Configuration",
    description: "Manage your API protection configuration",
    type: "website",
  },
};

// Lazy load the configuration component
const LazyConfigurationManager = () =>
  import("@/components/configuration/configuration-manager").then((mod) => ({
    default: mod.ConfigurationManager,
  }));

export default function ConfigurationPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<LoadingSkeleton variant="dashboard" />}>
        <LazyComponent
          loader={LazyConfigurationManager}
          fallback={<LoadingSkeleton variant="dashboard" />}
        />
      </Suspense>
    </DashboardLayout>
  );
}
