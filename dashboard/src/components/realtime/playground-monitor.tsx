"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Cpu,
  Database,
  Globe,
  MemoryStick,
  Network,
  Server,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { useRealtimeMetrics, useRealtimeAlerts } from "@/hooks/use-websocket";

type PlaygroundMetrics = {
  cpu: { usage: number };
  memory: { usage: number };
  timestamp: Date;
};

type PlaygroundAlert = {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
};

type ServiceHealth = {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  lastCheck: Date;
};

export default function PlaygroundMonitor() {
  const [playgroundUrl, setPlaygroundUrl] = useState("http://localhost:3000");
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastMetrics, setLastMetrics] = useState<PlaygroundMetrics | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<PlaygroundAlert[]>([]);
  const [servicesHealth, setServicesHealth] = useState<ServiceHealth[]>([]);

  // Use WebSocket hooks to connect to playground monitoring
  const websocketUrl = "http://localhost:3002"; // Playground WebSocket port
  const {
    systemMetrics,
    performanceMetrics,
    serviceHealth,
    isConnected: wsConnected,
  } = useRealtimeMetrics(websocketUrl);

  const {
    alerts,
    activeAlertsCount,
    resolveAlert,
    isConnected: alertsConnected,
  } = useRealtimeAlerts(websocketUrl);

  useEffect(() => {
    setIsConnected(wsConnected && alertsConnected);

    if (!wsConnected || !alertsConnected) {
      setConnectionError("Failed to connect to playground WebSocket");
    } else {
      setConnectionError(null);
    }
  }, [wsConnected, alertsConnected]);

  useEffect(() => {
    if (systemMetrics) {
      setLastMetrics({
        cpu: systemMetrics.cpu || { usage: 0 },
        memory: systemMetrics.memory || { usage: 0 },
        timestamp: new Date(),
      });
    }
  }, [systemMetrics]);

  useEffect(() => {
    if (serviceHealth) {
      setServicesHealth(serviceHealth);
    }
  }, [serviceHealth]);

  useEffect(() => {
    if (alerts) {
      setRecentAlerts(alerts.slice(0, 5)); // Show last 5 alerts
    }
  }, [alerts]);

  const testPlaygroundConnection = async () => {
    try {
      const response = await fetch(`${playgroundUrl}/monitoring-demo/health-status`);
      if (response.ok) {
        setConnectionError(null);
        return true;
      } else {
        setConnectionError(`HTTP ${response.status}: ${response.statusText}`);
        return false;
      }
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Connection failed");
      return false;
    }
  };

  const triggerTestAlert = async (severity: "low" | "medium" | "high" | "critical") => {
    try {
      const response = await fetch(`${playgroundUrl}/monitoring-demo/trigger-alert/${severity}`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger alert: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("Alert triggered:", result);
    } catch (error) {
      console.error("Error triggering alert:", error);
      setConnectionError(error instanceof Error ? error.message : "Failed to trigger alert");
    }
  };

  const simulateLoad = async (type: "cpu" | "memory" | "io") => {
    try {
      const response = await fetch(`${playgroundUrl}/monitoring-demo/system-load?type=${type}`);

      if (!response.ok) {
        throw new Error(`Failed to simulate load: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("Load simulation result:", result);
    } catch (error) {
      console.error("Error simulating load:", error);
      setConnectionError(error instanceof Error ? error.message : "Failed to simulate load");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "unhealthy":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Server className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Playground Monitor</h1>
          <p className="text-muted-foreground mt-2">
            Real-time monitoring of NestShield playground application
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge variant="default" className="flex items-center gap-1">
              <Wifi className="w-3 h-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="destructive" className="flex items-center gap-1">
              <WifiOff className="w-3 h-3" />
              Disconnected
            </Badge>
          )}
        </div>
      </div>

      {/* Connection Status */}
      {connectionError && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Connection Error: {connectionError}</AlertDescription>
        </Alert>
      )}

      {/* Connection Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="w-5 h-5" />
            Connection Test
          </CardTitle>
          <CardDescription>Test connectivity to the playground application</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={testPlaygroundConnection} variant="outline">
              Test HTTP Connection
            </Button>
            <Button onClick={() => triggerTestAlert("medium")} variant="outline">
              Trigger Test Alert
            </Button>
            <Button onClick={() => simulateLoad("cpu")} variant="outline">
              Simulate CPU Load
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastMetrics ? `${lastMetrics.cpu.usage.toFixed(1)}%` : "--"}
            </div>
            {lastMetrics && <Progress value={lastMetrics.cpu.usage} className="mt-2" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastMetrics ? `${lastMetrics.memory.usage.toFixed(1)}%` : "--"}
            </div>
            {lastMetrics && <Progress value={lastMetrics.memory.usage} className="mt-2" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAlertsCount}</div>
            <p className="text-xs text-muted-foreground">{recentAlerts.length} total alerts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WebSocket Status</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isConnected ? "Online" : "Offline"}</div>
            <p className="text-xs text-muted-foreground">Real-time monitoring</p>
          </CardContent>
        </Card>
      </div>

      {/* Services Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Service Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {servicesHealth.length > 0 ? (
              servicesHealth.map((service) => (
                <div
                  key={service.service}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(service.status)}
                    <div>
                      <div className="font-medium">{service.service}</div>
                      <div className="text-sm text-muted-foreground">
                        Response: {service.responseTime}ms
                      </div>
                    </div>
                  </div>
                  <Badge variant={service.status === "healthy" ? "default" : "destructive"}>
                    {service.status}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-4">
                No service health data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentAlerts.length > 0 ? (
              recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getSeverityColor(alert.severity)}`} />
                    <div>
                      <div className="font-medium">{alert.title}</div>
                      <div className="text-sm text-muted-foreground">{alert.message}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={alert.severity === "critical" ? "destructive" : "secondary"}>
                      {alert.severity}
                    </Badge>
                    {!alert.resolved && (
                      <Button size="sm" variant="outline" onClick={() => resolveAlert(alert.id)}>
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-4">No recent alerts</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Test Actions
          </CardTitle>
          <CardDescription>Trigger various events to test the monitoring system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button onClick={() => triggerTestAlert("low")} variant="outline" size="sm">
              Low Alert
            </Button>
            <Button onClick={() => triggerTestAlert("medium")} variant="outline" size="sm">
              Medium Alert
            </Button>
            <Button onClick={() => triggerTestAlert("high")} variant="outline" size="sm">
              High Alert
            </Button>
            <Button onClick={() => triggerTestAlert("critical")} variant="outline" size="sm">
              Critical Alert
            </Button>
            <Button onClick={() => simulateLoad("cpu")} variant="outline" size="sm">
              CPU Load
            </Button>
            <Button onClick={() => simulateLoad("memory")} variant="outline" size="sm">
              Memory Load
            </Button>
            <Button onClick={() => simulateLoad("io")} variant="outline" size="sm">
              I/O Load
            </Button>
            <Button onClick={testPlaygroundConnection} variant="outline" size="sm">
              Health Check
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
