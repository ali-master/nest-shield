"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Settings,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { RealtimeMetricsChart } from "./realtime-metrics-chart";
import { PerformanceGauge } from "./performance-gauge";
import { SystemResourcesGrid } from "./system-resources-grid";
import { AlertsTimeline } from "./alerts-timeline";
import { ServiceHealthMatrix } from "./service-health-matrix";
import { useRealtimeAlerts, useRealtimeMetrics } from "@/hooks/use-websocket";

type DashboardProps = {
  websocketUrl?: string;
};

export function RealtimeDashboard({ websocketUrl = "http://localhost:3000" }: DashboardProps) {
  useTranslations();
  const [activeTab, setActiveTab] = useState("overview");
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  // WebSocket connections for real-time data
  const {
    systemMetrics,
    performanceMetrics,
    serviceHealth,
    isConnected: metricsConnected,
  } = useRealtimeMetrics(websocketUrl);

  const {
    alerts,
    activeAlertsCount,
    resolveAlert,
    isConnected: alertsConnected,
  } = useRealtimeAlerts(websocketUrl);

  // Mock data for development (replace with real data)
  const [mockData, setMockData] = useState({
    overview: {
      requestsPerSecond: 1247,
      averageResponseTime: 245,
      errorRate: 0.12,
      uptime: 99.9,
      activeConnections: 342,
      blockedRequests: 23,
    },
    protection: {
      rateLimit: { active: true, triggered: 23, efficiency: 98.2 },
      circuitBreaker: { active: true, triggered: 0, efficiency: 100 },
      throttle: { active: true, triggered: 5, efficiency: 99.4 },
      anomalyDetection: { active: true, detected: 2, efficiency: 97.8 },
    },
    system: {
      cpu: { usage: 67, cores: 8, loadAverage: [1.2, 1.5, 1.8] },
      memory: { usage: 84, total: 16, used: 13.4, available: 2.6 },
      network: { bytesIn: 450, bytesOut: 320, connectionsActive: 142 },
      disk: { usage: 45, total: 500, used: 225, available: 275 },
    },
  });

  // Update mock data periodically if not connected to WebSocket
  // @ts-ignore
  useEffect(() => {
    if (!metricsConnected && isAutoRefresh) {
      const interval = setInterval(() => {
        setMockData((prev) => ({
          ...prev,
          overview: {
            ...prev.overview,
            requestsPerSecond: Math.floor(Math.random() * 200) + 1100,
            averageResponseTime: Math.floor(Math.random() * 100) + 200,
            errorRate: Math.random() * 0.5,
            activeConnections: Math.floor(Math.random() * 100) + 300,
          },
          system: {
            ...prev.system,
            cpu: {
              ...prev.system.cpu,
              usage: Math.max(10, Math.min(95, prev.system.cpu.usage + (Math.random() - 0.5) * 10)),
            },
            memory: {
              ...prev.system.memory,
              usage: Math.max(
                20,
                Math.min(95, prev.system.memory.usage + (Math.random() - 0.5) * 5),
              ),
            },
          },
        }));
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [metricsConnected, isAutoRefresh]);

  const getConnectionStatus = () => {
    if (metricsConnected && alertsConnected) return "connected";
    if (metricsConnected || alertsConnected) return "partial";
    return "disconnected";
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="space-y-6">
      {/* Header with Connection Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Real-time Dashboard</h1>
          <p className="text-muted-foreground">
            Live monitoring and analytics for NestShield protection
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full animate-pulse ${
                connectionStatus === "connected"
                  ? "bg-green-500"
                  : connectionStatus === "partial"
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
            />
            <span className="text-sm text-muted-foreground">
              {connectionStatus === "connected"
                ? "Live"
                : connectionStatus === "partial"
                  ? "Partial"
                  : "Offline"}
            </span>
          </div>

          {/* Auto Refresh Toggle */}
          <Button
            variant={isAutoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isAutoRefresh ? "animate-spin" : ""}`} />
            Auto Refresh
          </Button>

          {/* Settings */}
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requests/sec</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {systemMetrics?.shield?.requestsTotal || mockData.overview.requestsPerSecond}
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span>+12.3% from last hour</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {systemMetrics?.shield?.averageResponseTime || mockData.overview.averageResponseTime}
              ms
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <TrendingDown className="h-3 w-3 text-green-500" />
              <span>-8.2% improvement</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-950 dark:to-violet-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Protection Rate</CardTitle>
            <Shield className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {mockData.overview.uptime}%
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>All systems operational</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-red-100 dark:from-orange-950 dark:to-red-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
              {activeAlertsCount || 3}
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 text-orange-500" />
              <span>2 require attention</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Live Metrics</TabsTrigger>
          <TabsTrigger value="protection">Protection</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Performance Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5" />
                  <span>Performance Overview</span>
                </CardTitle>
                <CardDescription>Real-time performance metrics and trends</CardDescription>
              </CardHeader>
              <CardContent>
                <RealtimeMetricsChart data={performanceMetrics || mockData.overview} height={300} />
              </CardContent>
            </Card>

            {/* System Health Matrix */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Service Health</span>
                </CardTitle>
                <CardDescription>Current status of all services and components</CardDescription>
              </CardHeader>
              <CardContent>
                <ServiceHealthMatrix
                  services={
                    serviceHealth || [
                      {
                        service: "database",
                        status: "healthy",
                        responseTime: 45,
                        lastCheck: new Date(),
                      },
                      {
                        service: "redis",
                        status: "healthy",
                        responseTime: 12,
                        lastCheck: new Date(),
                      },
                      {
                        service: "api",
                        status: "degraded",
                        responseTime: 89,
                        lastCheck: new Date(),
                      },
                    ]
                  }
                />
              </CardContent>
            </Card>
          </div>

          {/* Protection Status Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(mockData.protection).map(([key, protection]) => (
              <Card key={key}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium capitalize">
                    {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                  </CardTitle>
                  <Badge variant={protection.active ? "default" : "secondary"}>
                    {protection.active ? "Active" : "Inactive"}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Efficiency</span>
                      <span className="font-medium">{protection.efficiency}%</span>
                    </div>
                    <Progress value={protection.efficiency} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        Triggered:{" "}
                        {"triggered" in protection ? protection.triggered : protection.detected}
                      </span>
                      <span>24h</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Live Metrics Tab */}
        <TabsContent value="metrics" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Real-time Performance Metrics</CardTitle>
                  <CardDescription>Live data streams with 1-second updates</CardDescription>
                </CardHeader>
                <CardContent>
                  <RealtimeMetricsChart
                    data={performanceMetrics || mockData.overview}
                    height={400}
                    showLegend
                    interactive
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* Performance Gauges */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Performance Indicators</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <PerformanceGauge
                    label="CPU Usage"
                    value={systemMetrics?.cpu?.usage || mockData.system.cpu.usage}
                    max={100}
                    unit="%"
                    color="blue"
                  />
                  <PerformanceGauge
                    label="Memory Usage"
                    value={systemMetrics?.memory?.usage || mockData.system.memory.usage}
                    max={100}
                    unit="%"
                    color="green"
                  />
                  <PerformanceGauge
                    label="Error Rate"
                    value={systemMetrics?.shield?.errorRate || mockData.overview.errorRate}
                    max={10}
                    unit="%"
                    color="red"
                  />
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Active Connections</span>
                    <span className="font-medium">{mockData.overview.activeConnections}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Blocked Requests</span>
                    <span className="font-medium text-red-600">
                      {mockData.overview.blockedRequests}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Uptime</span>
                    <span className="font-medium text-green-600">{mockData.overview.uptime}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Protection Tab */}
        <TabsContent value="protection" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {Object.entries(mockData.protection).map(([key, protection]) => (
              <Card key={key}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="capitalize">{key.replace(/([A-Z])/g, " $1")}</CardTitle>
                      <CardDescription>Protection mechanism status and performance</CardDescription>
                    </div>
                    <Badge variant={protection.active ? "default" : "secondary"}>
                      {protection.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Efficiency Rate</span>
                      <span className="font-medium">{protection.efficiency}%</span>
                    </div>
                    <Progress value={protection.efficiency} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Triggered</span>
                      <div className="font-medium text-lg">
                        {"triggered" in protection ? protection.triggered : protection.detected}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last 24h</span>
                      <div className="font-medium text-lg text-green-600">
                        {protection.efficiency > 95 ? "Excellent" : "Good"}
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          <SystemResourcesGrid systemData={systemMetrics || mockData.system} />
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <AlertsTimeline alerts={alerts || []} onResolveAlert={resolveAlert} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
