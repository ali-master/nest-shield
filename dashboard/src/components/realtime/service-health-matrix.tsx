"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Globe,
  Server,
  Shield,
  XCircle,
  Zap,
} from "lucide-react";

type ServiceHealth = {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  lastCheck: Date;
  details?: Record<string, any>;
  error?: string;
};

type ServiceHealthMatrixProps = {
  services: ServiceHealth[];
};

export function ServiceHealthMatrix({ services }: ServiceHealthMatrixProps) {
  // Mock services if none provided
  const mockServices: ServiceHealth[] = [
    {
      service: "database",
      status: "healthy",
      responseTime: 45,
      lastCheck: new Date(),
      details: { connections: 23, queries: "fast" },
    },
    {
      service: "redis",
      status: "healthy",
      responseTime: 12,
      lastCheck: new Date(),
      details: { memory: "85MB", connections: 15 },
    },
    {
      service: "api-gateway",
      status: "degraded",
      responseTime: 189,
      lastCheck: new Date(),
      details: { load: "high", queue: 45 },
    },
    {
      service: "auth-service",
      status: "healthy",
      responseTime: 67,
      lastCheck: new Date(),
      details: { tokens: "valid", sessions: 156 },
    },
    {
      service: "notification-service",
      status: "unhealthy",
      responseTime: 0,
      lastCheck: new Date(),
      error: "Connection timeout",
    },
    {
      service: "file-storage",
      status: "healthy",
      responseTime: 234,
      lastCheck: new Date(),
      details: { storage: "78%", bandwidth: "normal" },
    },
  ];

  const servicesToShow = services.length > 0 ? services : mockServices;

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

  const getServiceIcon = (serviceName: string) => {
    const name = serviceName.toLowerCase();
    if (name.includes("database") || name.includes("db")) {
      return <Database className="h-5 w-5" />;
    }
    if (name.includes("redis") || name.includes("cache")) {
      return <Zap className="h-5 w-5" />;
    }
    if (name.includes("api") || name.includes("gateway")) {
      return <Globe className="h-5 w-5" />;
    }
    if (name.includes("auth")) {
      return <Shield className="h-5 w-5" />;
    }
    if (name.includes("notification") || name.includes("email")) {
      return <Activity className="h-5 w-5" />;
    }
    return <Server className="h-5 w-5" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-100 text-green-800 border-green-200";
      case "degraded":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "unhealthy":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getResponseTimeColor = (responseTime: number) => {
    if (responseTime === 0) return "text-red-600";
    if (responseTime > 200) return "text-red-600";
    if (responseTime > 100) return "text-yellow-600";
    if (responseTime > 50) return "text-blue-600";
    return "text-green-600";
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    return `${diffInHours}h ago`;
  };

  const healthyCount = servicesToShow.filter((s) => s.status === "healthy").length;
  const degradedCount = servicesToShow.filter((s) => s.status === "degraded").length;
  const unhealthyCount = servicesToShow.filter((s) => s.status === "unhealthy").length;
  const totalServices = servicesToShow.length;
  const healthPercentage = totalServices > 0 ? (healthyCount / totalServices) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Health Summary */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{healthyCount}</div>
          <div className="text-xs text-muted-foreground">Healthy</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{degradedCount}</div>
          <div className="text-xs text-muted-foreground">Degraded</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{unhealthyCount}</div>
          <div className="text-xs text-muted-foreground">Unhealthy</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{healthPercentage.toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground">Overall</div>
        </div>
      </div>

      {/* Overall Health Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>System Health</span>
          <span className="font-medium">{healthPercentage.toFixed(1)}%</span>
        </div>
        <Progress value={healthPercentage} className="h-2" />
      </div>

      {/* Services Grid */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {servicesToShow.map((service) => (
          <TooltipProvider key={service.service}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Card
                  className={`transition-all duration-200 hover:shadow-md cursor-pointer ${
                    service.status === "healthy"
                      ? "border-green-200"
                      : service.status === "degraded"
                        ? "border-yellow-200"
                        : "border-red-200"
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="text-muted-foreground">
                          {getServiceIcon(service.service)}
                        </div>
                        <span className="font-medium capitalize">
                          {service.service.replace(/[-_]/g, " ")}
                        </span>
                      </div>
                      {getStatusIcon(service.status)}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant="outline" className={getStatusColor(service.status)}>
                          {service.status}
                        </Badge>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Response</span>
                        <span
                          className={`font-medium ${getResponseTimeColor(service.responseTime)}`}
                        >
                          {service.responseTime > 0 ? `${service.responseTime}ms` : "Timeout"}
                        </span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Last Check</span>
                        <span className="font-medium">{formatTimeAgo(service.lastCheck)}</span>
                      </div>

                      {/* Service-specific details */}
                      {service.details && Object.keys(service.details).length > 0 && (
                        <div className="pt-2 border-t">
                          <div className="text-xs text-muted-foreground space-y-1">
                            {Object.entries(service.details).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="capitalize">{key}</span>
                                <span className="font-medium">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Error message */}
                      {service.error && (
                        <div className="pt-2 border-t">
                          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                            {service.error}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-medium">{service.service}</div>
                  <div className="text-sm">Status: {service.status}</div>
                  <div className="text-sm">Response: {service.responseTime}ms</div>
                  <div className="text-sm">
                    Last check: {service.lastCheck.toLocaleTimeString()}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>

      {/* Service Status Legend */}
      <div className="flex items-center justify-center space-x-6 pt-4 border-t">
        <div className="flex items-center space-x-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm text-muted-foreground">Healthy</span>
        </div>
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <span className="text-sm text-muted-foreground">Degraded</span>
        </div>
        <div className="flex items-center space-x-2">
          <XCircle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-muted-foreground">Unhealthy</span>
        </div>
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Auto-refresh: 30s</span>
        </div>
      </div>
    </div>
  );
}
