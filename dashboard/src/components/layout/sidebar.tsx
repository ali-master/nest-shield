"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  Cloud,
  Database,
  Eye,
  FileText,
  Heart,
  Lock,
  Settings,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

const navigation = [
  {
    name: "overview",
    href: "/dashboard",
    icon: BarChart3,
    current: true,
  },
  {
    name: "metrics",
    href: "/dashboard/metrics",
    icon: Activity,
    current: false,
  },
  {
    name: "configuration",
    href: "/dashboard/configuration",
    icon: Settings,
    current: false,
  },
  {
    name: "alerts",
    href: "/dashboard/alerts",
    icon: AlertTriangle,
    current: false,
    badge: "3",
  },
  {
    name: "logs",
    href: "/dashboard/logs",
    icon: FileText,
    current: false,
  },
  {
    name: "health",
    href: "/dashboard/health",
    icon: Heart,
    current: false,
  },
];

const features = [
  {
    name: "Security Scanner",
    href: "/dashboard/features/security",
    icon: Shield,
  },
  {
    name: "Performance Optimizer",
    href: "/dashboard/features/performance",
    icon: Zap,
  },
  {
    name: "Traffic Analyzer",
    href: "/dashboard/features/traffic",
    icon: TrendingUp,
  },
  {
    name: "Predictive Scaling",
    href: "/dashboard/features/scaling",
    icon: Brain,
  },
  {
    name: "Compliance Monitor",
    href: "/dashboard/features/compliance",
    icon: Lock,
  },
  {
    name: "API Governance",
    href: "/dashboard/features/governance",
    icon: Users,
  },
  {
    name: "Data Privacy Scanner",
    href: "/dashboard/features/privacy",
    icon: Eye,
  },
  {
    name: "Cost Optimizer",
    href: "/dashboard/features/cost",
    icon: Database,
  },
  {
    name: "Incident Response",
    href: "/dashboard/features/incident",
    icon: AlertTriangle,
  },
  {
    name: "Business Intelligence",
    href: "/dashboard/features/bi",
    icon: Cloud,
  },
];

export function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-md">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">NestShield</h1>
            <p className="text-xs text-muted-foreground">Dashboard</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        {/* Main Navigation */}
        <div className="space-y-1">
          <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("dashboard.overview")}
          </p>
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    isActive && "bg-secondary text-secondary-foreground",
                  )}
                >
                  <item.icon className="w-4 h-4 me-3" />
                  {t(`dashboard.${item.name}`)}
                  {item.badge && (
                    <Badge variant="destructive" className="ms-auto">
                      {item.badge}
                    </Badge>
                  )}
                </Button>
              </Link>
            );
          })}
        </div>

        {/* Advanced Features */}
        <div className="mt-6 space-y-1">
          <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Advanced Features
          </p>
          {features.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "w-full justify-start text-xs",
                    isActive && "bg-secondary text-secondary-foreground",
                  )}
                >
                  <item.icon className="w-3 h-3 me-2" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>v1.0.0</span>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}
