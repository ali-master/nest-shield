"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Activity, Cpu, Database, Gauge, HardDrive, MemoryStick, Network, Zap } from "lucide-react";

type SystemResourcesGridProps = {
  systemData: {
    cpu?: {
      usage: number;
      cores?: number;
      loadAverage?: number[];
    };
    memory?: {
      usage: number;
      total?: number;
      used?: number;
      available?: number;
    };
    disk?: {
      usage: number;
      total?: number;
      used?: number;
      available?: number;
    };
    network?: {
      bytesIn?: number;
      bytesOut?: number;
      connectionsActive?: number;
    };
  };
};

export function SystemResourcesGrid({ systemData }: SystemResourcesGridProps) {
  const formatBytes = (bytes: number) => {
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / 1024 ** i).toFixed(1)} ${sizes[i]}`;
  };

  const getStatusColor = (usage: number) => {
    if (usage > 90) return "bg-red-500";
    if (usage > 80) return "bg-yellow-500";
    if (usage > 60) return "bg-blue-500";
    return "bg-green-500";
  };

  const getStatusText = (usage: number) => {
    if (usage > 90) return "Critical";
    if (usage > 80) return "High";
    if (usage > 60) return "Moderate";
    return "Normal";
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
      {/* CPU Usage */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cpu className="h-5 w-5 text-blue-600" />
              <CardTitle>CPU Usage</CardTitle>
            </div>
            <Badge variant="outline" className={getStatusColor(systemData.cpu?.usage || 0)}>
              {getStatusText(systemData.cpu?.usage || 0)}
            </Badge>
          </div>
          <CardDescription>Processor utilization and load metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>CPU Usage</span>
              <span className="font-medium">{(systemData.cpu?.usage || 0).toFixed(1)}%</span>
            </div>
            <Progress value={systemData.cpu?.usage || 0} className="h-3" />
          </div>

          {systemData.cpu?.cores && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">CPU Cores</span>
                  <div className="font-medium">{systemData.cpu.cores}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Load Average</span>
                  <div className="font-medium">
                    {systemData.cpu.loadAverage?.map((load) => load.toFixed(2)).join(", ") || "N/A"}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Memory Usage */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MemoryStick className="h-5 w-5 text-green-600" />
              <CardTitle>Memory Usage</CardTitle>
            </div>
            <Badge variant="outline" className={getStatusColor(systemData.memory?.usage || 0)}>
              {getStatusText(systemData.memory?.usage || 0)}
            </Badge>
          </div>
          <CardDescription>RAM utilization and availability</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Memory Usage</span>
              <span className="font-medium">{(systemData.memory?.usage || 0).toFixed(1)}%</span>
            </div>
            <Progress value={systemData.memory?.usage || 0} className="h-3" />
          </div>

          {systemData.memory?.total && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total</span>
                  <div className="font-medium">{systemData.memory.total} GB</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Available</span>
                  <div className="font-medium">{systemData.memory.available || 0} GB</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Disk Usage */}
      {systemData.disk && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="h-5 w-5 text-purple-600" />
                <CardTitle>Disk Usage</CardTitle>
              </div>
              <Badge variant="outline" className={getStatusColor(systemData.disk.usage)}>
                {getStatusText(systemData.disk.usage)}
              </Badge>
            </div>
            <CardDescription>Storage utilization and capacity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Disk Usage</span>
                <span className="font-medium">{systemData.disk.usage.toFixed(1)}%</span>
              </div>
              <Progress value={systemData.disk.usage} className="h-3" />
            </div>

            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total</span>
                <div className="font-medium">{systemData.disk.total} GB</div>
              </div>
              <div>
                <span className="text-muted-foreground">Available</span>
                <div className="font-medium">{systemData.disk.available} GB</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Network Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Network className="h-5 w-5 text-orange-600" />
            <CardTitle>Network Activity</CardTitle>
          </div>
          <CardDescription>Network traffic and connection metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {systemData.network && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <span className="text-muted-foreground">Bytes In</span>
                <div className="font-medium text-lg text-green-600">
                  {formatBytes((systemData.network.bytesIn || 0) * 1024)}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-muted-foreground">Bytes Out</span>
                <div className="font-medium text-lg text-blue-600">
                  {formatBytes((systemData.network.bytesOut || 0) * 1024)}
                </div>
              </div>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Active Connections</span>
            <span className="font-medium text-lg">
              {systemData.network?.connectionsActive || 0}
            </span>
          </div>

          {/* Network Status Indicator */}
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-muted-foreground">Network Active</span>
          </div>
        </CardContent>
      </Card>

      {/* Additional System Metrics */}
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-indigo-600" />
            <CardTitle>System Performance Overview</CardTitle>
          </div>
          <CardDescription>Comprehensive system health and performance indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center">
                <Gauge className="h-8 w-8 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {(systemData.cpu?.usage || 0).toFixed(0)}%
              </div>
              <div className="text-sm text-muted-foreground">CPU Load</div>
            </div>

            <div className="text-center space-y-2">
              <div className="flex items-center justify-center">
                <Database className="h-8 w-8 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-green-600">
                {(systemData.memory?.usage || 0).toFixed(0)}%
              </div>
              <div className="text-sm text-muted-foreground">Memory</div>
            </div>

            <div className="text-center space-y-2">
              <div className="flex items-center justify-center">
                <HardDrive className="h-8 w-8 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {(systemData.disk?.usage || 0).toFixed(0)}%
              </div>
              <div className="text-sm text-muted-foreground">Storage</div>
            </div>

            <div className="text-center space-y-2">
              <div className="flex items-center justify-center">
                <Zap className="h-8 w-8 text-yellow-500" />
              </div>
              <div className="text-2xl font-bold text-yellow-600">
                {systemData.network?.connectionsActive || 0}
              </div>
              <div className="text-sm text-muted-foreground">Connections</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
