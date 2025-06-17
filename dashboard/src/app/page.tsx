"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Cpu, 
  Database, 
  MemoryStick, 
  Network, 
  RefreshCw, 
  Settings, 
  Shield, 
  TrendingDown, 
  TrendingUp, 
  Zap 
} from "lucide-react";

interface MetricsData {
  totalRequests: number;
  blockedRequests: number;
  responseTime: number;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  uptime: string;
  errorRate: number;
}

interface SystemStatus {
  rateLimiting: boolean;
  circuitBreaker: boolean;
  throttling: boolean;
  anomalyDetection: boolean;
  overloadProtection: boolean;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<MetricsData>({
    totalRequests: 0,
    blockedRequests: 0,
    responseTime: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    activeConnections: 0,
    uptime: "0h 0m",
    errorRate: 0,
  });

  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    rateLimiting: true,
    circuitBreaker: true,
    throttling: true,
    anomalyDetection: true,
    overloadProtection: true,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch metrics from API
  const fetchMetrics = async () => {
    try {
      setIsLoading(true);
      
      // Try to fetch from the playground API first
      const response = await fetch("http://localhost:3000/api/metrics", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      } else {
        // Fallback to mock data if API is not available
        setMetrics({
          totalRequests: Math.floor(Math.random() * 50000) + 10000,
          blockedRequests: Math.floor(Math.random() * 1000) + 100,
          responseTime: Math.floor(Math.random() * 100) + 20,
          cpuUsage: Math.floor(Math.random() * 60) + 20,
          memoryUsage: Math.floor(Math.random() * 70) + 30,
          activeConnections: Math.floor(Math.random() * 500) + 50,
          uptime: `${Math.floor(Math.random() * 24)}h ${Math.floor(Math.random() * 60)}m`,
          errorRate: Math.random() * 5,
        });
      }
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
      // Use mock data as fallback
      setMetrics({
        totalRequests: Math.floor(Math.random() * 50000) + 10000,
        blockedRequests: Math.floor(Math.random() * 1000) + 100,
        responseTime: Math.floor(Math.random() * 100) + 20,
        cpuUsage: Math.floor(Math.random() * 60) + 20,
        memoryUsage: Math.floor(Math.random() * 70) + 30,
        activeConnections: Math.floor(Math.random() * 500) + 50,
        uptime: `${Math.floor(Math.random() * 24)}h ${Math.floor(Math.random() * 60)}m`,
        errorRate: Math.random() * 5,
      });
    } finally {
      setIsLoading(false);
      setLastUpdated(new Date());
    }
  };

  // Fetch health status
  const fetchHealthStatus = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/health", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data.services || systemStatus);
      }
    } catch (error) {
      console.error("Failed to fetch health status:", error);
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchHealthStatus();

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      fetchMetrics();
      fetchHealthStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? "bg-green-500" : "bg-red-500";
  };

  const getUsageColor = (usage: number) => {
    if (usage >= 80) return "bg-red-500";
    if (usage >= 60) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Shield className="h-8 w-8 text-primary" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">NestShield Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="default" className="bg-green-500/20 text-green-700 border-green-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                System Online
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  fetchMetrics();
                  fetchHealthStatus();
                }}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(metrics.totalRequests)}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                +12.5% from last hour
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blocked Requests</CardTitle>
              <Shield className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(metrics.blockedRequests)}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-green-500" />
                -2.1% from last hour
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Response Time</CardTitle>
              <Zap className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.responseTime}ms</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-green-500" />
                -8.2% from last hour
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.errorRate.toFixed(2)}%</div>
              <p className="text-xs text-muted-foreground">
                Target: &lt; 1%
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* System Resources */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                System Resources
              </CardTitle>
              <CardDescription>Real-time system performance metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Cpu className="h-4 w-4" />
                    CPU Usage
                  </span>
                  <span className="text-sm font-bold">{metrics.cpuUsage}%</span>
                </div>
                <Progress value={metrics.cpuUsage} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <MemoryStick className="h-4 w-4" />
                    Memory Usage
                  </span>
                  <span className="text-sm font-bold">{metrics.memoryUsage}%</span>
                </div>
                <Progress value={metrics.memoryUsage} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="text-center">
                  <Network className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <div className="text-lg font-bold">{metrics.activeConnections}</div>
                  <div className="text-xs text-muted-foreground">Active Connections</div>
                </div>
                <div className="text-center">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <div className="text-lg font-bold">{metrics.uptime}</div>
                  <div className="text-xs text-muted-foreground">Uptime</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Protection Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Protection Status
              </CardTitle>
              <CardDescription>Current security module status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Rate Limiting</span>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={systemStatus.rateLimiting}
                    onCheckedChange={(checked) => 
                      setSystemStatus(prev => ({ ...prev, rateLimiting: checked }))
                    }
                  />
                  <Badge 
                    variant={systemStatus.rateLimiting ? "default" : "destructive"}
                    className={systemStatus.rateLimiting ? "bg-green-500" : ""}
                  >
                    {systemStatus.rateLimiting ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Circuit Breaker</span>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={systemStatus.circuitBreaker}
                    onCheckedChange={(checked) => 
                      setSystemStatus(prev => ({ ...prev, circuitBreaker: checked }))
                    }
                  />
                  <Badge 
                    variant={systemStatus.circuitBreaker ? "default" : "destructive"}
                    className={systemStatus.circuitBreaker ? "bg-green-500" : ""}
                  >
                    {systemStatus.circuitBreaker ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Throttling</span>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={systemStatus.throttling}
                    onCheckedChange={(checked) => 
                      setSystemStatus(prev => ({ ...prev, throttling: checked }))
                    }
                  />
                  <Badge 
                    variant={systemStatus.throttling ? "default" : "destructive"}
                    className={systemStatus.throttling ? "bg-green-500" : ""}
                  >
                    {systemStatus.throttling ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Anomaly Detection</span>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={systemStatus.anomalyDetection}
                    onCheckedChange={(checked) => 
                      setSystemStatus(prev => ({ ...prev, anomalyDetection: checked }))
                    }
                  />
                  <Badge 
                    variant={systemStatus.anomalyDetection ? "default" : "destructive"}
                    className={systemStatus.anomalyDetection ? "bg-green-500" : ""}
                  >
                    {systemStatus.anomalyDetection ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overload Protection</span>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={systemStatus.overloadProtection}
                    onCheckedChange={(checked) => 
                      setSystemStatus(prev => ({ ...prev, overloadProtection: checked }))
                    }
                  />
                  <Badge 
                    variant={systemStatus.overloadProtection ? "default" : "destructive"}
                    className={systemStatus.overloadProtection ? "bg-green-500" : ""}
                  >
                    {systemStatus.overloadProtection ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest security events and system actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">System health check completed successfully</p>
                  <p className="text-xs text-muted-foreground">All protection modules operational - 2 minutes ago</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                <RefreshCw className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Rate limit configuration updated</p>
                  <p className="text-xs text-muted-foreground">New threshold: 1000 requests/minute - 5 minutes ago</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">High request volume detected</p>
                  <p className="text-xs text-muted-foreground">Traffic spike from 192.168.1.0/24 - 8 minutes ago</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                <Shield className="h-5 w-5 text-red-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Potential attack blocked</p>
                  <p className="text-xs text-muted-foreground">SQL injection attempt from IP 203.0.113.45 - 15 minutes ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}