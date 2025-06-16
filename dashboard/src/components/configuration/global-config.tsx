"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Clock,
  Database,
  RefreshCw,
  Save,
  Server,
  Settings,
  Shield,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export function GlobalConfig() {
  const _t = useTranslations();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [globalSettings, setGlobalSettings] = useState({
    // General Settings
    enableShield: true,
    logLevel: "info",
    metricsEnabled: true,
    healthCheckEnabled: true,

    // Storage Settings
    storageType: "memory",
    redisUrl: "redis://localhost:6379",
    memcachedUrl: "localhost:11211",
    ttl: 3600,

    // Rate Limiting Defaults
    defaultRateLimit: 100,
    defaultWindowMs: 60000,

    // Circuit Breaker Defaults
    defaultFailureThreshold: 5,
    defaultRecoveryTimeout: 30000,

    // Throttling Defaults
    defaultThrottleLimit: 10,
    defaultThrottleTtl: 60000,

    // Monitoring Settings
    monitoringInterval: 5000,
    alertsEnabled: true,
    webhookUrl: "",

    // Security Settings
    trustProxy: false,
    skipWhitelist: [],

    // Performance Settings
    maxMemoryUsage: 80,
    maxCpuUsage: 80,
    gracefulShutdown: true,
  });

  const handleSave = async () => {
    setLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    toast({
      title: "Global configuration saved",
      description: "All global settings have been successfully updated.",
    });

    setLoading(false);
  };

  const handleReset = () => {
    // Reset to default values
    setGlobalSettings({
      enableShield: true,
      logLevel: "info",
      metricsEnabled: true,
      healthCheckEnabled: true,
      storageType: "memory",
      redisUrl: "redis://localhost:6379",
      memcachedUrl: "localhost:11211",
      ttl: 3600,
      defaultRateLimit: 100,
      defaultWindowMs: 60000,
      defaultFailureThreshold: 5,
      defaultRecoveryTimeout: 30000,
      defaultThrottleLimit: 10,
      defaultThrottleTtl: 60000,
      monitoringInterval: 5000,
      alertsEnabled: true,
      webhookUrl: "",
      trustProxy: false,
      skipWhitelist: [],
      maxMemoryUsage: 80,
      maxCpuUsage: 80,
      gracefulShutdown: true,
    });

    toast({
      title: "Configuration reset",
      description: "All settings have been reset to default values.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Global Configuration</h2>
          <p className="text-muted-foreground">Configure system-wide settings and default values</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleReset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <CardTitle>General Settings</CardTitle>
            </div>
            <CardDescription>Core system configuration and behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enableShield">Enable NestShield</Label>
                <p className="text-sm text-muted-foreground">Master switch for all protection</p>
              </div>
              <Switch
                id="enableShield"
                checked={globalSettings.enableShield}
                onCheckedChange={(checked) =>
                  setGlobalSettings((prev) => ({ ...prev, enableShield: checked }))
                }
              />
            </div>

            <div>
              <Label htmlFor="logLevel">Log Level</Label>
              <Select
                value={globalSettings.logLevel}
                onValueChange={(value) =>
                  setGlobalSettings((prev) => ({ ...prev, logLevel: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="verbose">Verbose</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="metricsEnabled">Enable Metrics Collection</Label>
                <p className="text-sm text-muted-foreground">Collect performance metrics</p>
              </div>
              <Switch
                id="metricsEnabled"
                checked={globalSettings.metricsEnabled}
                onCheckedChange={(checked) =>
                  setGlobalSettings((prev) => ({ ...prev, metricsEnabled: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="healthCheckEnabled">Enable Health Checks</Label>
                <p className="text-sm text-muted-foreground">Periodic system health monitoring</p>
              </div>
              <Switch
                id="healthCheckEnabled"
                checked={globalSettings.healthCheckEnabled}
                onCheckedChange={(checked) =>
                  setGlobalSettings((prev) => ({ ...prev, healthCheckEnabled: checked }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Storage Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <CardTitle>Storage Configuration</CardTitle>
            </div>
            <CardDescription>Configure data storage and caching</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="storageType">Storage Type</Label>
              <Select
                value={globalSettings.storageType}
                onValueChange={(value) =>
                  setGlobalSettings((prev) => ({ ...prev, storageType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="memory">In-Memory</SelectItem>
                  <SelectItem value="redis">Redis</SelectItem>
                  <SelectItem value="memcached">Memcached</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {globalSettings.storageType === "redis" && (
              <div>
                <Label htmlFor="redisUrl">Redis URL</Label>
                <Input
                  id="redisUrl"
                  value={globalSettings.redisUrl}
                  onChange={(e) =>
                    setGlobalSettings((prev) => ({ ...prev, redisUrl: e.target.value }))
                  }
                  placeholder="redis://localhost:6379"
                />
              </div>
            )}

            {globalSettings.storageType === "memcached" && (
              <div>
                <Label htmlFor="memcachedUrl">Memcached URL</Label>
                <Input
                  id="memcachedUrl"
                  value={globalSettings.memcachedUrl}
                  onChange={(e) =>
                    setGlobalSettings((prev) => ({ ...prev, memcachedUrl: e.target.value }))
                  }
                  placeholder="localhost:11211"
                />
              </div>
            )}

            <div>
              <Label htmlFor="ttl">Default TTL (seconds)</Label>
              <Input
                id="ttl"
                type="number"
                value={globalSettings.ttl}
                onChange={(e) =>
                  setGlobalSettings((prev) => ({ ...prev, ttl: Number.parseInt(e.target.value) }))
                }
                min="60"
              />
            </div>
          </CardContent>
        </Card>

        {/* Rate Limiting Defaults */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <CardTitle>Rate Limiting Defaults</CardTitle>
            </div>
            <CardDescription>Default values for new rate limit configurations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="defaultRateLimit">Default Rate Limit</Label>
              <Input
                id="defaultRateLimit"
                type="number"
                value={globalSettings.defaultRateLimit}
                onChange={(e) =>
                  setGlobalSettings((prev) => ({
                    ...prev,
                    defaultRateLimit: Number.parseInt(e.target.value),
                  }))
                }
                min="1"
              />
            </div>

            <div>
              <Label htmlFor="defaultWindowMs">Default Window (ms)</Label>
              <Input
                id="defaultWindowMs"
                type="number"
                value={globalSettings.defaultWindowMs}
                onChange={(e) =>
                  setGlobalSettings((prev) => ({
                    ...prev,
                    defaultWindowMs: Number.parseInt(e.target.value),
                  }))
                }
                min="1000"
              />
            </div>
          </CardContent>
        </Card>

        {/* Circuit Breaker Defaults */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Circuit Breaker Defaults</CardTitle>
            </div>
            <CardDescription>Default values for new circuit breaker configurations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="defaultFailureThreshold">Default Failure Threshold</Label>
              <Input
                id="defaultFailureThreshold"
                type="number"
                value={globalSettings.defaultFailureThreshold}
                onChange={(e) =>
                  setGlobalSettings((prev) => ({
                    ...prev,
                    defaultFailureThreshold: Number.parseInt(e.target.value),
                  }))
                }
                min="1"
              />
            </div>

            <div>
              <Label htmlFor="defaultRecoveryTimeout">Default Recovery Timeout (ms)</Label>
              <Input
                id="defaultRecoveryTimeout"
                type="number"
                value={globalSettings.defaultRecoveryTimeout}
                onChange={(e) =>
                  setGlobalSettings((prev) => ({
                    ...prev,
                    defaultRecoveryTimeout: Number.parseInt(e.target.value),
                  }))
                }
                min="1000"
              />
            </div>
          </CardContent>
        </Card>

        {/* Monitoring Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Server className="h-5 w-5" />
              <CardTitle>Monitoring Settings</CardTitle>
            </div>
            <CardDescription>Configure monitoring and alerting behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="monitoringInterval">Monitoring Interval (ms)</Label>
              <Input
                id="monitoringInterval"
                type="number"
                value={globalSettings.monitoringInterval}
                onChange={(e) =>
                  setGlobalSettings((prev) => ({
                    ...prev,
                    monitoringInterval: Number.parseInt(e.target.value),
                  }))
                }
                min="1000"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="alertsEnabled">Enable Alerts</Label>
                <p className="text-sm text-muted-foreground">Send notifications for issues</p>
              </div>
              <Switch
                id="alertsEnabled"
                checked={globalSettings.alertsEnabled}
                onCheckedChange={(checked) =>
                  setGlobalSettings((prev) => ({ ...prev, alertsEnabled: checked }))
                }
              />
            </div>

            <div>
              <Label htmlFor="webhookUrl">Webhook URL (Optional)</Label>
              <Input
                id="webhookUrl"
                value={globalSettings.webhookUrl}
                onChange={(e) =>
                  setGlobalSettings((prev) => ({ ...prev, webhookUrl: e.target.value }))
                }
                placeholder="https://hooks.example.com/webhook"
              />
            </div>
          </CardContent>
        </Card>

        {/* Performance Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle>Performance Thresholds</CardTitle>
            </div>
            <CardDescription>Configure system performance limits and alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="maxMemoryUsage">Max Memory Usage (%)</Label>
              <Input
                id="maxMemoryUsage"
                type="number"
                value={globalSettings.maxMemoryUsage}
                onChange={(e) =>
                  setGlobalSettings((prev) => ({
                    ...prev,
                    maxMemoryUsage: Number.parseInt(e.target.value),
                  }))
                }
                min="50"
                max="95"
              />
            </div>

            <div>
              <Label htmlFor="maxCpuUsage">Max CPU Usage (%)</Label>
              <Input
                id="maxCpuUsage"
                type="number"
                value={globalSettings.maxCpuUsage}
                onChange={(e) =>
                  setGlobalSettings((prev) => ({
                    ...prev,
                    maxCpuUsage: Number.parseInt(e.target.value),
                  }))
                }
                min="50"
                max="95"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="gracefulShutdown">Enable Graceful Shutdown</Label>
                <p className="text-sm text-muted-foreground">Properly close connections on exit</p>
              </div>
              <Switch
                id="gracefulShutdown"
                checked={globalSettings.gracefulShutdown}
                onCheckedChange={(checked) =>
                  setGlobalSettings((prev) => ({ ...prev, gracefulShutdown: checked }))
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
