"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertCircle,
  Brain,
  CheckCircle,
  Settings,
  Shield,
  TrendingDown,
  Zap,
} from "lucide-react";

export function ProtectionStatus() {
  const t = useTranslations();

  const protectionServices = [
    {
      id: "rateLimit",
      name: t("protection.rateLimit"),
      icon: TrendingDown,
      status: "active",
      enabled: true,
      metrics: {
        blocked: 23,
        processed: 1247,
        efficiency: 98.2,
      },
      config: {
        windowMs: 60000,
        maxRequests: 100,
      },
    },
    {
      id: "circuitBreaker",
      name: t("protection.circuitBreaker"),
      icon: Zap,
      status: "active",
      enabled: true,
      metrics: {
        services: 12,
        triggered: 0,
        efficiency: 100,
      },
      config: {
        failureThreshold: 5,
        recoveryTimeout: 30000,
      },
    },
    {
      id: "throttle",
      name: t("protection.throttle"),
      icon: Activity,
      status: "active",
      enabled: true,
      metrics: {
        limited: 5,
        processed: 856,
        efficiency: 99.4,
      },
      config: {
        ttl: 1000,
        limit: 10,
      },
    },
    {
      id: "anomalyDetection",
      name: t("protection.anomalyDetection"),
      icon: Brain,
      status: "active",
      enabled: true,
      metrics: {
        anomalies: 2,
        patterns: 156,
        efficiency: 97.8,
      },
      config: {
        threshold: 0.85,
        sensitivity: "medium",
      },
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "triggered":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "inactive":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "triggered":
        return "bg-yellow-100 text-yellow-800";
      case "inactive":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Protection Status</span>
            </CardTitle>
            <CardDescription>Current status of all protection mechanisms</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {protectionServices.map((service) => {
          const Icon = service.icon;
          return (
            <div key={service.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{service.name}</div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(service.status)}
                      <Badge className={getStatusColor(service.status)}>
                        {t(`protection.status.${service.status}`)}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Switch checked={service.enabled} onCheckedChange={() => {}} />
              </div>

              {/* Metrics */}
              <div className="ml-8 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Efficiency</span>
                  <span className="font-medium">{service.metrics.efficiency}%</span>
                </div>
                <Progress value={service.metrics.efficiency} className="h-2" />

                <div className="grid grid-cols-2 gap-4 text-sm">
                  {service.id === "rateLimit" && (
                    <>
                      <div>
                        <span className="text-muted-foreground">Blocked:</span>
                        <span className="ml-2 font-medium text-red-600">
                          {service.metrics.blocked}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Processed:</span>
                        <span className="ml-2 font-medium">{service.metrics.processed}</span>
                      </div>
                    </>
                  )}
                  {service.id === "circuitBreaker" && (
                    <>
                      <div>
                        <span className="text-muted-foreground">Services:</span>
                        <span className="ml-2 font-medium">{service.metrics.services}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Triggered:</span>
                        <span className="ml-2 font-medium text-yellow-600">
                          {service.metrics.triggered}
                        </span>
                      </div>
                    </>
                  )}
                  {service.id === "throttle" && (
                    <>
                      <div>
                        <span className="text-muted-foreground">Limited:</span>
                        <span className="ml-2 font-medium text-orange-600">
                          {service.metrics.limited}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Processed:</span>
                        <span className="ml-2 font-medium">{service.metrics.processed}</span>
                      </div>
                    </>
                  )}
                  {service.id === "anomalyDetection" && (
                    <>
                      <div>
                        <span className="text-muted-foreground">Anomalies:</span>
                        <span className="ml-2 font-medium text-red-600">
                          {service.metrics.anomalies}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Patterns:</span>
                        <span className="ml-2 font-medium">{service.metrics.patterns}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
