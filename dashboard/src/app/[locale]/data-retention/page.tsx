"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  Database,
  Edit,
  FileText,
  Info,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  Plus,
  Settings,
  Shield,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RetentionPolicy = {
  id: number;
  name: string;
  description: string;
  dataType: string;
  retentionPeriodDays: number;
  cleanupFrequency: string;
  isActive: boolean;
  lastCleanupAt: string | null;
  nextCleanupAt: string | null;
  totalRecordsDeleted: number;
};

type CleanupJob = {
  id: number;
  policyId: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  recordsDeleted: number;
  errorMessage: string | null;
};

const DataRetentionPage = () => {
  const t = useTranslations("dataRetention");
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [cleanupJobs, setCleanupJobs] = useState<CleanupJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [_selectedPolicy, _setSelectedPolicy] = useState<RetentionPolicy | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [_isEditDialogOpen, _setIsEditDialogOpen] = useState(false);
  const [globalConfig, setGlobalConfig] = useState({
    globalEnabled: true,
    maxConcurrentJobs: 3,
    batchSize: 1000,
    jobTimeout: 3600,
  });

  // Form state for creating/editing policies
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    dataType: "",
    retentionPeriodDays: 30,
    cleanupFrequency: "daily",
  });

  const dataTypeOptions = [
    { value: "activity_logs", label: t("types.logs"), icon: FileText, color: "bg-blue-500" },
    { value: "metrics", label: t("types.metrics"), icon: BarChart3, color: "bg-green-500" },
    { value: "request_logs", label: t("types.audits"), icon: Shield, color: "bg-purple-500" },
    { value: "alerts", label: t("types.alerts"), icon: AlertTriangle, color: "bg-red-500" },
  ];

  const frequencyOptions = [
    { value: "daily", label: t("schedule.daily") },
    { value: "weekly", label: t("schedule.weekly") },
    { value: "monthly", label: t("schedule.monthly") },
  ];

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load mock data - replace with actual API calls
      const mockPolicies: RetentionPolicy[] = [
        {
          id: 1,
          name: "Activity Logs Cleanup",
          description: "Remove activity logs older than 90 days",
          dataType: "activity_logs",
          retentionPeriodDays: 90,
          cleanupFrequency: "daily",
          isActive: true,
          lastCleanupAt: "2024-01-15T02:00:00Z",
          nextCleanupAt: "2024-01-16T02:00:00Z",
          totalRecordsDeleted: 15420,
        },
        {
          id: 2,
          name: "Metrics Retention",
          description: "Keep performance metrics for 30 days",
          dataType: "metrics",
          retentionPeriodDays: 30,
          cleanupFrequency: "weekly",
          isActive: true,
          lastCleanupAt: "2024-01-14T01:00:00Z",
          nextCleanupAt: "2024-01-21T01:00:00Z",
          totalRecordsDeleted: 45000,
        },
        {
          id: 3,
          name: "Alert History",
          description: "Maintain alert history for 180 days",
          dataType: "alerts",
          retentionPeriodDays: 180,
          cleanupFrequency: "monthly",
          isActive: false,
          lastCleanupAt: null,
          nextCleanupAt: null,
          totalRecordsDeleted: 0,
        },
      ];

      const mockJobs: CleanupJob[] = [
        {
          id: 1,
          policyId: 1,
          status: "completed",
          startedAt: "2024-01-15T02:00:00Z",
          completedAt: "2024-01-15T02:05:30Z",
          recordsDeleted: 1250,
          errorMessage: null,
        },
        {
          id: 2,
          policyId: 2,
          status: "running",
          startedAt: "2024-01-15T03:00:00Z",
          completedAt: null,
          recordsDeleted: 0,
          errorMessage: null,
        },
      ];

      setPolicies(mockPolicies);
      setCleanupJobs(mockJobs);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreatePolicy = async () => {
    try {
      // API call to create policy
      const newPolicy: RetentionPolicy = {
        id: policies.length + 1,
        ...formData,
        isActive: true,
        lastCleanupAt: null,
        nextCleanupAt: null,
        totalRecordsDeleted: 0,
      };

      setPolicies([...policies, newPolicy]);
      setIsCreateDialogOpen(false);
      setFormData({
        name: "",
        description: "",
        dataType: "",
        retentionPeriodDays: 30,
        cleanupFrequency: "daily",
      });
    } catch (error) {
      console.error("Error creating policy:", error);
    }
  };

  const handleTogglePolicy = async (id: number, isActive: boolean) => {
    try {
      setPolicies(policies.map((p) => (p.id === id ? { ...p, isActive } : p)));
    } catch (error) {
      console.error("Error toggling policy:", error);
    }
  };

  const handleRunCleanup = async (policyId: number) => {
    try {
      // API call to trigger cleanup job
      const newJob: CleanupJob = {
        id: cleanupJobs.length + 1,
        policyId,
        status: "running",
        startedAt: new Date().toISOString(),
        completedAt: null,
        recordsDeleted: 0,
        errorMessage: null,
      };

      setCleanupJobs([...cleanupJobs, newJob]);
    } catch (error) {
      console.error("Error running cleanup:", error);
    }
  };

  const getDataTypeConfig = (dataType: string) => {
    return dataTypeOptions.find((option) => option.value === dataType) || dataTypeOptions[0];
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: "secondary" as const, icon: Clock },
      running: { variant: "default" as const, icon: PlayCircle },
      completed: { variant: "default" as const, icon: CheckCircle },
      failed: { variant: "destructive" as const, icon: AlertTriangle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-2">{t("description")}</p>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => loadData()}>
            <Activity className="w-4 h-4 me-2" />
            Refresh
          </Button>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 me-2" />
                {t("policies.create")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{t("policies.create")}</DialogTitle>
                <DialogDescription>
                  Create a new data retention policy to automatically clean up old data.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Policy Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter policy name"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe this policy"
                    rows={3}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="dataType">Data Type</Label>
                  <Select
                    value={formData.dataType}
                    onValueChange={(value) => setFormData({ ...formData, dataType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select data type" />
                    </SelectTrigger>
                    <SelectContent>
                      {dataTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.icon className="w-4 h-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="retentionPeriod">Retention Period (Days)</Label>
                  <Input
                    id="retentionPeriod"
                    type="number"
                    value={formData.retentionPeriodDays}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        retentionPeriodDays: Number.parseInt(e.target.value),
                      })
                    }
                    min="1"
                    max="3650"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="frequency">Cleanup Frequency</Label>
                  <Select
                    value={formData.cleanupFrequency}
                    onValueChange={(value) => setFormData({ ...formData, cleanupFrequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {frequencyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreatePolicy}
                  disabled={!formData.name || !formData.dataType}
                >
                  Create Policy
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="policies" className="space-y-6">
        <TabsList>
          <TabsTrigger value="policies">Retention Policies</TabsTrigger>
          <TabsTrigger value="jobs">Cleanup Jobs</TabsTrigger>
          <TabsTrigger value="settings">Configuration</TabsTrigger>
        </TabsList>

        {/* Policies Tab */}
        <TabsContent value="policies" className="space-y-6">
          {/* Global Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Data Retention Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {policies.filter((p) => p.isActive).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Active Policies</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {policies.reduce((sum, p) => sum + p.totalRecordsDeleted, 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Records Cleaned</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {cleanupJobs.filter((j) => j.status === "running").length}
                  </div>
                  <div className="text-sm text-muted-foreground">Running Jobs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {globalConfig.globalEnabled ? "Enabled" : "Disabled"}
                  </div>
                  <div className="text-sm text-muted-foreground">Global Status</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Policies List */}
          <div className="grid gap-4">
            {policies.map((policy) => {
              const dataTypeConfig = getDataTypeConfig(policy.dataType);
              if (!dataTypeConfig) return null;
              const Icon = dataTypeConfig.icon;

              return (
                <motion.div
                  key={policy.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card
                    className={`transition-all ${policy.isActive ? "border-primary/20" : "border-muted"}`}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${dataTypeConfig.color} text-white`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{policy.name}</CardTitle>
                            <CardDescription>{policy.description}</CardDescription>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={policy.isActive}
                            onCheckedChange={(checked) => handleTogglePolicy(policy.id, checked)}
                          />

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleRunCleanup(policy.id)}>
                                <PlayCircle className="w-4 h-4 me-2" />
                                Run Cleanup Now
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="w-4 h-4 me-2" />
                                Edit Policy
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive">
                                <Trash2 className="w-4 h-4 me-2" />
                                Delete Policy
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Data Type</div>
                          <div className="font-medium">{dataTypeConfig.label}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Retention Period</div>
                          <div className="font-medium">{policy.retentionPeriodDays} days</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Frequency</div>
                          <div className="font-medium capitalize">{policy.cleanupFrequency}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Records Deleted</div>
                          <div className="font-medium">
                            {policy.totalRecordsDeleted.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {policy.lastCleanupAt && (
                        <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Last: {new Date(policy.lastCleanupAt).toLocaleString()}
                          </div>
                          {policy.nextCleanupAt && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Next: {new Date(policy.nextCleanupAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Cleanup Jobs</CardTitle>
              <CardDescription>
                View the status and results of data retention cleanup jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Policy</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Records Deleted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cleanupJobs.map((job) => {
                      const policy = policies.find((p) => p.id === job.policyId);
                      const duration =
                        job.completedAt && job.startedAt
                          ? Math.round(
                              (new Date(job.completedAt).getTime() -
                                new Date(job.startedAt).getTime()) /
                                1000,
                            )
                          : null;

                      return (
                        <TableRow key={job.id}>
                          <TableCell>
                            <div className="font-medium">{policy?.name || "Unknown"}</div>
                            <div className="text-xs text-muted-foreground">{policy?.dataType}</div>
                          </TableCell>
                          <TableCell>{getStatusBadge(job.status)}</TableCell>
                          <TableCell>
                            {job.startedAt
                              ? new Date(job.startedAt).toLocaleString()
                              : "Not started"}
                          </TableCell>
                          <TableCell>
                            {duration
                              ? `${duration}s`
                              : job.status === "running"
                                ? "Running..."
                                : "-"}
                          </TableCell>
                          <TableCell>{job.recordsDeleted.toLocaleString()}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Info className="w-4 h-4 me-2" />
                                  View Details
                                </DropdownMenuItem>
                                {job.status === "running" && (
                                  <DropdownMenuItem>
                                    <PauseCircle className="w-4 h-4 me-2" />
                                    Cancel Job
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Global Configuration
              </CardTitle>
              <CardDescription>
                Configure global settings for the data retention system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Enable Data Retention</Label>
                  <p className="text-sm text-muted-foreground">
                    Globally enable or disable all data retention policies
                  </p>
                </div>
                <Switch
                  checked={globalConfig.globalEnabled}
                  onCheckedChange={(checked) =>
                    setGlobalConfig({ ...globalConfig, globalEnabled: checked })
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="maxJobs">Max Concurrent Jobs</Label>
                  <Input
                    id="maxJobs"
                    type="number"
                    value={globalConfig.maxConcurrentJobs}
                    onChange={(e) =>
                      setGlobalConfig({
                        ...globalConfig,
                        maxConcurrentJobs: Number.parseInt(e.target.value),
                      })
                    }
                    min="1"
                    max="10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum number of cleanup jobs running simultaneously
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="batchSize">Batch Size</Label>
                  <Input
                    id="batchSize"
                    type="number"
                    value={globalConfig.batchSize}
                    onChange={(e) =>
                      setGlobalConfig({
                        ...globalConfig,
                        batchSize: Number.parseInt(e.target.value),
                      })
                    }
                    min="100"
                    max="10000"
                    step="100"
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of records to process in each batch
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jobTimeout">Job Timeout (seconds)</Label>
                  <Input
                    id="jobTimeout"
                    type="number"
                    value={globalConfig.jobTimeout}
                    onChange={(e) =>
                      setGlobalConfig({
                        ...globalConfig,
                        jobTimeout: Number.parseInt(e.target.value),
                      })
                    }
                    min="300"
                    max="86400"
                    step="300"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum time a cleanup job can run before timing out
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button>Save Configuration</Button>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Data retention policies help you comply with data protection regulations and manage
              storage costs by automatically cleaning up old data. Always test policies in a
              non-production environment first.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataRetentionPage;
