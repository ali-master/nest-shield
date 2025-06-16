"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, RefreshCw, XCircle } from "lucide-react";

type HealthStatus = {
  status: string;
  timestamp: string;
  services: Record<string, any>;
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
};

export function SystemHealth() {
  const t = useTranslations();
  const [healthData, setHealthData] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/health");
      const data = await response.json();
      setHealthData(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Failed to fetch health data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "unhealthy":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-100 text-green-800";
      case "degraded":
        return "bg-yellow-100 text-yellow-800";
      case "unhealthy":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <span>{t("health.title")}</span>
              {healthData && getStatusIcon(healthData.status)}
            </CardTitle>
            <CardDescription>System components and service status</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchHealthData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Status */}
        {healthData && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center space-x-3">
              {getStatusIcon(healthData.status)}
              <div>
                <div className="font-medium">Overall Status</div>
                <div className="text-sm text-muted-foreground">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </div>
              </div>
            </div>
            <Badge className={getStatusColor(healthData.status)}>{healthData.status}</Badge>
          </div>
        )}

        {/* Summary */}
        {healthData && (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{healthData.summary.healthy}</div>
              <div className="text-xs text-muted-foreground">{t("health.status.healthy")}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {healthData.summary.degraded}
              </div>
              <div className="text-xs text-muted-foreground">{t("health.status.degraded")}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{healthData.summary.unhealthy}</div>
              <div className="text-xs text-muted-foreground">{t("health.status.unhealthy")}</div>
            </div>
          </div>
        )}

        {/* Service Details */}
        {healthData?.services && (
          <div className="space-y-3">
            <h4 className="font-medium">{t("health.services")}</h4>
            {Object.entries(healthData.services).map(([serviceName, service]: [string, any]) => (
              <div
                key={serviceName}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(service.status)}
                  <div>
                    <div className="font-medium capitalize">{serviceName.replace("_", " ")}</div>
                    <div className="text-sm text-muted-foreground">
                      {t("health.responseTime")}: {service.responseTime}ms
                    </div>
                    {service.details?.uptime && (
                      <div className="text-xs text-muted-foreground">
                        {t("health.uptime")}: {formatUptime(service.details.uptime)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className={getStatusColor(service.status)}>
                    {service.status}
                  </Badge>
                  {service.error && (
                    <div className="text-xs text-red-500 mt-1">{service.error}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* System Resources */}
        {healthData?.services?.system?.details && (
          <div className="space-y-3">
            <h4 className="font-medium">System Resources</h4>
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Memory Usage</span>
                  <span>
                    {Math.round(healthData.services.system.details.memory.heapUsed / 1024 / 1024)}MB
                    /{Math.round(healthData.services.system.details.memory.heapTotal / 1024 / 1024)}
                    MB
                  </span>
                </div>
                <Progress
                  value={
                    (healthData.services.system.details.memory.heapUsed /
                      healthData.services.system.details.memory.heapTotal) *
                    100
                  }
                  className="h-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Platform:</span>
                  <span className="ml-2">{healthData.services.system.details.platform}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Node.js:</span>
                  <span className="ml-2">{healthData.services.system.details.nodeVersion}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && !healthData && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading health data...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
