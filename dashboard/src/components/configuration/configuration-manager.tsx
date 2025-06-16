"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Brain,
  Copy,
  Download,
  Edit,
  Plus,
  Settings,
  Shield,
  Trash2,
  TrendingDown,
  Upload,
  Zap,
} from "lucide-react";
import { RateLimitConfig } from "./rate-limit-config";
import { CircuitBreakerConfig } from "./circuit-breaker-config";
import { ThrottleConfig } from "./throttle-config";
import { AnomalyDetectionConfig } from "./anomaly-detection-config";
import { GlobalConfig } from "./global-config";
import { useToast } from "@/components/ui/use-toast";

type Config = {
  id: string;
  name: string;
  type: "rateLimit" | "circuitBreaker" | "throttle" | "anomalyDetection";
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
};

export function ConfigurationManager() {
  const _t = useTranslations();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("rate-limits");
  const [configs, setConfigs] = useState<Record<string, Config[]>>({
    "rate-limits": [],
    "circuit-breakers": [],
    throttles: [],
    "anomaly-detection": [],
  });
  const [loading, setLoading] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<Config | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const loadMockConfigurations = () => {
    const mockConfigs = {
      "rate-limits": [
        {
          id: "rl_1",
          name: "API Rate Limit",
          type: "rateLimit" as const,
          path: "/api/*",
          method: "ALL",
          windowMs: 60000,
          maxRequests: 100,
          enabled: true,
          createdAt: new Date(Date.now() - 86400000),
          updatedAt: new Date(),
        },
        {
          id: "rl_2",
          name: "Auth Rate Limit",
          type: "rateLimit" as const,
          path: "/auth/*",
          method: "POST",
          windowMs: 900000,
          maxRequests: 5,
          enabled: true,
          createdAt: new Date(Date.now() - 172800000),
          updatedAt: new Date(Date.now() - 3600000),
        },
      ],
      "circuit-breakers": [
        {
          id: "cb_1",
          name: "Database Circuit Breaker",
          type: "circuitBreaker" as const,
          service: "database",
          failureThreshold: 5,
          recoveryTimeout: 30000,
          monitoringPeriod: 60000,
          enabled: true,
          createdAt: new Date(Date.now() - 259200000),
          updatedAt: new Date(Date.now() - 7200000),
        },
      ],
      throttles: [
        {
          id: "th_1",
          name: "Heavy Operation Throttle",
          type: "throttle" as const,
          path: "/api/heavy/*",
          ttl: 60000,
          limit: 5,
          enabled: true,
          createdAt: new Date(Date.now() - 345600000),
          updatedAt: new Date(Date.now() - 10800000),
        },
      ],
      "anomaly-detection": [
        {
          id: "ad_1",
          name: "Request Pattern Detection",
          type: "anomalyDetection" as const,
          detectorType: "statistical",
          threshold: 0.95,
          sensitivity: "medium",
          windowSize: 100,
          features: ["request_rate", "response_time", "error_rate"],
          enabled: true,
          createdAt: new Date(Date.now() - 432000000),
          updatedAt: new Date(Date.now() - 14400000),
        },
      ],
    };

    setConfigs(mockConfigs);
  };

  // Mock configuration data
  useEffect(() => {
    loadMockConfigurations();
  }, []);

  const handleCreateConfig = (type: string) => {
    setSelectedConfig(null);
    setIsEditing(false);
    setActiveTab(type);
    setIsDialogOpen(true);
  };

  const handleEditConfig = (config: Config) => {
    setSelectedConfig(config);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleDeleteConfig = async (configId: string, type: string) => {
    setLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    setConfigs((prev) => ({
      ...prev,
      [type]: prev[type].filter((config) => config.id !== configId),
    }));

    toast({
      title: "Configuration deleted",
      description: "The configuration has been successfully deleted.",
    });

    setLoading(false);
  };

  const handleSaveConfig = async (configData: any) => {
    setLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (isEditing && selectedConfig) {
      // Update existing config
      const updatedConfig = {
        ...selectedConfig,
        ...configData,
        updatedAt: new Date(),
      };

      setConfigs((prev) => ({
        ...prev,
        [activeTab]: prev[activeTab].map((config) =>
          config.id === selectedConfig.id ? updatedConfig : config,
        ),
      }));

      toast({
        title: "Configuration updated",
        description: "The configuration has been successfully updated.",
      });
    } else {
      // Create new config
      const newConfig: Config = {
        id: `${activeTab.slice(0, 2)}_${Date.now()}`,
        ...configData,
        type: activeTab.replace("-", "") as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setConfigs((prev) => ({
        ...prev,
        [activeTab]: [...prev[activeTab], newConfig],
      }));

      toast({
        title: "Configuration created",
        description: "The new configuration has been successfully created.",
      });
    }

    setLoading(false);
    setIsDialogOpen(false);
  };

  const handleToggleConfig = async (configId: string, type: string, enabled: boolean) => {
    setConfigs((prev) => ({
      ...prev,
      [type]: prev[type].map((config) =>
        config.id === configId ? { ...config, enabled, updatedAt: new Date() } : config,
      ),
    }));

    toast({
      title: enabled ? "Configuration enabled" : "Configuration disabled",
      description: `The configuration has been ${enabled ? "enabled" : "disabled"}.`,
    });
  };

  const handleExportConfiguration = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      configurations: configs,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nestshield-config-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Configuration exported",
      description: "Configuration has been exported successfully.",
    });
  };

  const getConfigIcon = (type: string) => {
    switch (type) {
      case "rate-limits":
        return <TrendingDown className="h-4 w-4" />;
      case "circuit-breakers":
        return <Zap className="h-4 w-4" />;
      case "throttles":
        return <Shield className="h-4 w-4" />;
      case "anomaly-detection":
        return <Brain className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getTabStats = (type: string) => {
    const configList = configs[type] || [];
    const total = configList.length;
    const enabled = configList.filter((config) => config.enabled).length;
    return { total, enabled };
  };

  const renderConfigurationForm = () => {
    switch (activeTab) {
      case "rate-limits":
        return (
          <RateLimitConfig
            config={selectedConfig}
            onSave={handleSaveConfig}
            onCancel={() => setIsDialogOpen(false)}
            loading={loading}
          />
        );
      case "circuit-breakers":
        return (
          <CircuitBreakerConfig
            config={selectedConfig}
            onSave={handleSaveConfig}
            onCancel={() => setIsDialogOpen(false)}
            loading={loading}
          />
        );
      case "throttles":
        return (
          <ThrottleConfig
            config={selectedConfig}
            onSave={handleSaveConfig}
            onCancel={() => setIsDialogOpen(false)}
            loading={loading}
          />
        );
      case "anomaly-detection":
        return (
          <AnomalyDetectionConfig
            config={selectedConfig}
            onSave={handleSaveConfig}
            onCancel={() => setIsDialogOpen(false)}
            loading={loading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuration Management</h1>
          <p className="text-muted-foreground">
            Manage and configure NestShield protection mechanisms
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleExportConfiguration}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={() => handleCreateConfig(activeTab)}>
            <Plus className="h-4 w-4 mr-2" />
            Create New
          </Button>
        </div>
      </div>

      {/* Configuration Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="rate-limits" className="flex items-center space-x-2">
            <TrendingDown className="h-4 w-4" />
            <span>Rate Limits</span>
            <Badge variant="secondary">{getTabStats("rate-limits").total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="circuit-breakers" className="flex items-center space-x-2">
            <Zap className="h-4 w-4" />
            <span>Circuit Breakers</span>
            <Badge variant="secondary">{getTabStats("circuit-breakers").total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="throttles" className="flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span>Throttles</span>
            <Badge variant="secondary">{getTabStats("throttles").total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="anomaly-detection" className="flex items-center space-x-2">
            <Brain className="h-4 w-4" />
            <span>Anomaly Detection</span>
            <Badge variant="secondary">{getTabStats("anomaly-detection").total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="global" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Global</span>
          </TabsTrigger>
        </TabsList>

        {/* Configuration Lists */}
        {["rate-limits", "circuit-breakers", "throttles", "anomaly-detection"].map((tabKey) => (
          <TabsContent key={tabKey} value={tabKey} className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getConfigIcon(tabKey)}
                    <CardTitle className="capitalize">
                      {tabKey.replace("-", " ")} Configurations
                    </CardTitle>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">
                      {getTabStats(tabKey).enabled} enabled / {getTabStats(tabKey).total} total
                    </Badge>
                    <Button size="sm" onClick={() => handleCreateConfig(tabKey)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add New
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Configure and manage {tabKey.replace("-", " ")} rules and policies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {(configs[tabKey] || []).map((config) => (
                      <Card key={config.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Switch
                              checked={config.enabled}
                              onCheckedChange={(enabled) =>
                                handleToggleConfig(config.id, tabKey, enabled)
                              }
                            />
                            <div>
                              <h4 className="font-medium">{config.name}</h4>
                              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                <span>Updated {config.updatedAt.toLocaleDateString()}</span>
                                {config.enabled ? (
                                  <Badge variant="outline" className="bg-green-50 text-green-700">
                                    Active
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-gray-50 text-gray-700">
                                    Inactive
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditConfig(config)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{config.name}"? This action
                                    cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteConfig(config.id, tabKey)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>

                        {/* Configuration Details */}
                        <div className="mt-3 text-sm text-muted-foreground">
                          {tabKey === "rate-limits" && (
                            <span>
                              {config.path} - {config.maxRequests} requests per{" "}
                              {config.windowMs / 1000}s
                            </span>
                          )}
                          {tabKey === "circuit-breakers" && (
                            <span>
                              {config.service} - {config.failureThreshold} failures,{" "}
                              {config.recoveryTimeout / 1000}s recovery
                            </span>
                          )}
                          {tabKey === "throttles" && (
                            <span>
                              {config.path} - {config.limit} requests per {config.ttl / 1000}s
                            </span>
                          )}
                          {tabKey === "anomaly-detection" && (
                            <span>
                              {config.detectorType} - {config.threshold} threshold,{" "}
                              {config.sensitivity} sensitivity
                            </span>
                          )}
                        </div>
                      </Card>
                    ))}

                    {(configs[tabKey] || []).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No configurations found</p>
                        <Button
                          variant="outline"
                          className="mt-2"
                          onClick={() => handleCreateConfig(tabKey)}
                        >
                          Create your first configuration
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        {/* Global Configuration Tab */}
        <TabsContent value="global" className="space-y-4">
          <GlobalConfig />
        </TabsContent>
      </Tabs>

      {/* Configuration Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit" : "Create"} {activeTab.replace("-", " ")} Configuration
            </DialogTitle>
            <DialogDescription>
              Configure the settings for this {activeTab.replace("-", " ")} rule.
            </DialogDescription>
          </DialogHeader>
          {renderConfigurationForm()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
