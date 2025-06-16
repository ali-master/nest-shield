"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export function DashboardOverview() {
  const t = useTranslations();

  const stats = [
    {
      title: t("metrics.requests"),
      value: "847,392",
      change: "+12.3%",
      trend: "up",
      icon: Activity,
      description: "Total requests in the last 24 hours",
    },
    {
      title: t("metrics.responseTime"),
      value: "245ms",
      change: "-8.2%",
      trend: "down",
      icon: Clock,
      description: "Average response time",
    },
    {
      title: t("protection.status.active"),
      value: "98.7%",
      change: "+0.3%",
      trend: "up",
      icon: Shield,
      description: "Protection uptime",
    },
    {
      title: t("alerts.title"),
      value: "3",
      change: "+2",
      trend: "up",
      icon: AlertTriangle,
      description: "Active alerts requiring attention",
    },
  ];

  const protectionServices = [
    { name: "Rate Limiting", status: "active", requests: 1247, blocked: 23 },
    { name: "Circuit Breaker", status: "active", services: 12, triggered: 0 },
    { name: "Throttling", status: "active", endpoints: 45, limited: 5 },
    { name: "Anomaly Detection", status: "active", patterns: 156, anomalies: 2 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isPositive = stat.trend === "up";
          const TrendIcon = isPositive ? TrendingUp : TrendingDown;

          return (
            <Card key={stat.title} className="animate-fade-in">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendIcon
                    className={`h-3 w-3 ${isPositive ? "text-green-500" : "text-red-500"}`}
                  />
                  <span className={isPositive ? "text-green-500" : "text-red-500"}>
                    {stat.change}
                  </span>
                  <span>from last period</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Protection Services Status */}
      <Card className="animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Protection Services</span>
          </CardTitle>
          <CardDescription>Real-time status of all protection mechanisms</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {protectionServices.map((service) => (
              <div key={service.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{service.name}</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      {service.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {service.requests && <span>{service.requests} requests</span>}
                  {service.services && <span>{service.services} services</span>}
                  {service.endpoints && <span>{service.endpoints} endpoints</span>}
                  {service.patterns && <span>{service.patterns} patterns</span>}
                  <span className="text-red-500">
                    {service.blocked ||
                      service.triggered ||
                      service.limited ||
                      service.anomalies ||
                      0}{" "}
                    blocked
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Health Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>System Load</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>CPU Usage</span>
                <span>67%</span>
              </div>
              <Progress value={67} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Memory Usage</span>
                <span>84%</span>
              </div>
              <Progress value={84} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Network I/O</span>
                <span>45%</span>
              </div>
              <Progress value={45} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>API Requests</span>
                <span>78.3%</span>
              </div>
              <Progress value={78.3} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Static Files</span>
                <span>15.7%</span>
              </div>
              <Progress value={15.7} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>WebSocket</span>
                <span>6.0%</span>
              </div>
              <Progress value={6.0} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
