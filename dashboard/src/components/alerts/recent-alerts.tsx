"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, ExternalLink, Shield, TrendingUp } from "lucide-react";

export function RecentAlerts() {
  const t = useTranslations();

  const mockAlerts = [
    {
      id: 1,
      type: "rateLimit",
      severity: "high",
      title: "Rate limit exceeded on /api/users",
      message: "API endpoint /api/users has exceeded the rate limit of 100 requests per minute",
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      isResolved: false,
    },
    {
      id: 2,
      type: "circuitBreaker",
      severity: "critical",
      title: "Circuit breaker triggered for database service",
      message: "Database service circuit breaker has been triggered due to high failure rate",
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      isResolved: false,
    },
    {
      id: 3,
      type: "anomaly",
      severity: "medium",
      title: "Unusual traffic pattern detected",
      message:
        "Anomaly detection has identified unusual traffic patterns from IP range 192.168.1.0/24",
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      isResolved: true,
    },
    {
      id: 4,
      type: "systemHealth",
      severity: "low",
      title: "High memory usage detected",
      message: "System memory usage has exceeded 85% threshold",
      timestamp: new Date(Date.now() - 60 * 60 * 1000),
      isResolved: true,
    },
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "rateLimit":
        return <TrendingUp className="h-4 w-4" />;
      case "circuitBreaker":
        return <Shield className="h-4 w-4" />;
      case "anomaly":
        return <AlertTriangle className="h-4 w-4" />;
      case "systemHealth":
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return "Just now";
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else {
      const diffInHours = Math.floor(diffInMinutes / 60);
      return `${diffInHours}h ago`;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <span>{t("alerts.title")}</span>
            </CardTitle>
            <CardDescription>Recent security and performance alerts</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 border rounded-lg ${
                alert.isResolved ? "opacity-60" : ""
              } hover:bg-muted/50 transition-colors`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="mt-1">{getTypeIcon(alert.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium">{alert.title}</h4>
                      {alert.isResolved && (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          {t("alerts.resolved")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>
                    <div className="flex items-center space-x-4">
                      <Badge className={getSeverityColor(alert.severity)}>
                        {t(`alerts.severity.${alert.severity}`)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(alert.timestamp)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t(`alerts.types.${alert.type}`)}
                      </span>
                    </div>
                  </div>
                </div>
                {!alert.isResolved && (
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      {t("alerts.acknowledge")}
                    </Button>
                    <Button variant="outline" size="sm">
                      {t("alerts.resolve")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
