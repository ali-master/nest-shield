"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  MoreVertical,
  Shield,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Alert = {
  id: string;
  type: "performance" | "security" | "availability" | "anomaly";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
};

type AlertsTimelineProps = {
  alerts: Alert[];
  onResolveAlert: (alertId: string) => void;
};

export function AlertsTimeline({ alerts, onResolveAlert }: AlertsTimelineProps) {
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  // Mock alerts if none provided
  const mockAlerts: Alert[] = [
    {
      id: "1",
      type: "performance",
      severity: "high",
      title: "High CPU Usage Detected",
      message: "CPU usage has exceeded 85% for more than 5 minutes",
      timestamp: new Date(Date.now() - 300000), // 5 minutes ago
      resolved: false,
      metadata: { cpuUsage: 87.5, threshold: 85 },
    },
    {
      id: "2",
      type: "security",
      severity: "critical",
      title: "Rate Limit Exceeded",
      message: "Multiple IPs are exceeding rate limits on /api/auth endpoint",
      timestamp: new Date(Date.now() - 600000), // 10 minutes ago
      resolved: false,
      metadata: { endpoint: "/api/auth", exceededIPs: 15 },
    },
    {
      id: "3",
      type: "anomaly",
      severity: "medium",
      title: "Unusual Traffic Pattern",
      message: "Anomaly detection identified unusual traffic pattern from IP range 192.168.1.0/24",
      timestamp: new Date(Date.now() - 900000), // 15 minutes ago
      resolved: true,
      resolvedAt: new Date(Date.now() - 300000),
      metadata: { ipRange: "192.168.1.0/24", confidence: 0.92 },
    },
    {
      id: "4",
      type: "availability",
      severity: "low",
      title: "Database Connection Slow",
      message: "Database response time has increased to 250ms average",
      timestamp: new Date(Date.now() - 1200000), // 20 minutes ago
      resolved: true,
      resolvedAt: new Date(Date.now() - 600000),
      metadata: { avgResponseTime: 250, threshold: 200 },
    },
  ];

  const alertsToShow = alerts.length > 0 ? alerts : mockAlerts;

  const filteredAlerts = alertsToShow.filter((alert) => {
    if (filter === "active" && alert.resolved) return false;
    if (filter === "resolved" && !alert.resolved) return false;
    if (severityFilter !== "all" && alert.severity !== severityFilter) return false;
    return true;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "performance":
        return <TrendingUp className="h-4 w-4" />;
      case "security":
        return <Shield className="h-4 w-4" />;
      case "availability":
        return <Zap className="h-4 w-4" />;
      case "anomaly":
        return <Eye className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const activeAlertsCount = filteredAlerts.filter((alert) => !alert.resolved).length;
  const criticalAlertsCount = filteredAlerts.filter(
    (alert) => !alert.resolved && alert.severity === "critical",
  ).length;

  return (
    <div className="space-y-6">
      {/* Header and Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Alerts & Notifications</h2>
          <p className="text-muted-foreground">Monitor and manage system alerts in real-time</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{criticalAlertsCount}</div>
            <div className="text-xs text-muted-foreground">Critical</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{activeAlertsCount}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Alert Filters</CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">{filteredAlerts.length} alerts</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {["all", "active", "resolved"].map((filterOption) => (
              <Button
                key={filterOption}
                variant={filter === filterOption ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(filterOption as any)}
              >
                {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
              </Button>
            ))}

            <Separator orientation="vertical" className="h-6" />

            {["all", "critical", "high", "medium", "low"].map((severity) => (
              <Button
                key={severity}
                variant={severityFilter === severity ? "default" : "outline"}
                size="sm"
                onClick={() => setSeverityFilter(severity)}
              >
                {severity.charAt(0).toUpperCase() + severity.slice(1)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alerts Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
          <CardDescription>Chronological view of system alerts and incidents</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {filteredAlerts.map((alert, index) => (
                <div key={alert.id} className="relative">
                  {/* Timeline connector */}
                  {index < filteredAlerts.length - 1 && (
                    <div className="absolute left-6 top-12 w-0.5 h-8 bg-border" />
                  )}

                  <div
                    className={`flex space-x-4 p-4 rounded-lg border ${
                      alert.resolved ? "bg-muted/50" : "bg-background"
                    }`}
                  >
                    {/* Alert Icon */}
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                        alert.resolved ? "bg-green-100" : getSeverityColor(alert.severity)
                      }`}
                    >
                      {alert.resolved ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        getTypeIcon(alert.type)
                      )}
                    </div>

                    {/* Alert Content */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{alert.title}</h4>
                          <p className="text-sm text-muted-foreground">{alert.message}</p>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!alert.resolved && (
                              <DropdownMenuItem onClick={() => onResolveAlert(alert.id)}>
                                Mark as Resolved
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Create Incident</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Alert Metadata */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                        <Badge variant="outline">{alert.type}</Badge>
                        {alert.resolved && (
                          <Badge variant="outline" className="bg-green-100 text-green-800">
                            Resolved
                          </Badge>
                        )}
                      </div>

                      {/* Timestamps */}
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>Created {formatTimeAgo(alert.timestamp)}</span>
                        </div>
                        {alert.resolved && alert.resolvedAt && (
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="h-3 w-3" />
                            <span>Resolved {formatTimeAgo(alert.resolvedAt)}</span>
                          </div>
                        )}
                      </div>

                      {/* Metadata */}
                      {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                        <div className="mt-2 p-2 bg-muted rounded text-xs">
                          <span className="font-medium">Details: </span>
                          {Object.entries(alert.metadata).map(([key, value]) => (
                            <span key={key} className="mr-2">
                              {key}: {typeof value === "number" ? value.toFixed(2) : String(value)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action Buttons */}
                      {!alert.resolved && (
                        <div className="flex space-x-2 pt-2">
                          <Button size="sm" onClick={() => onResolveAlert(alert.id)}>
                            Resolve
                          </Button>
                          <Button size="sm" variant="outline">
                            Investigate
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {filteredAlerts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No alerts match your current filters</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
