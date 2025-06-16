"use client";

import { useState } from "react";
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
import { DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";

type AnomalyDetectionConfigProps = {
  config?: any;
  onSave: (config: any) => void;
  onCancel: () => void;
  loading: boolean;
};

export function AnomalyDetectionConfig({
  config,
  onSave,
  onCancel,
  loading,
}: AnomalyDetectionConfigProps) {
  const [formData, setFormData] = useState({
    name: config?.name || "",
    detectorType: config?.detectorType || "statistical",
    threshold: config?.threshold || 0.95,
    sensitivity: config?.sensitivity || "medium",
    windowSize: config?.windowSize || 100,
    features: config?.features || ["request_rate", "response_time", "error_rate"],
    minSamples: config?.minSamples || 10,
    alertThreshold: config?.alertThreshold || 0.8,
    enabled: config?.enabled ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleFeaturesChange = (value: string) => {
    const features = value
      .split(",")
      .map((feature) => feature.trim())
      .filter(Boolean);
    setFormData((prev) => ({ ...prev, features }));
  };

  const availableFeatures = [
    "request_rate",
    "response_time",
    "error_rate",
    "status_codes",
    "request_size",
    "response_size",
    "concurrent_requests",
    "cpu_usage",
    "memory_usage",
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Configuration Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Request Pattern Detection"
            required
          />
        </div>
        <div>
          <Label htmlFor="detectorType">Detector Type</Label>
          <Select
            value={formData.detectorType}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, detectorType: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="statistical">Statistical</SelectItem>
              <SelectItem value="isolation_forest">Isolation Forest</SelectItem>
              <SelectItem value="one_class_svm">One-Class SVM</SelectItem>
              <SelectItem value="autoencoder">Autoencoder</SelectItem>
              <SelectItem value="zscore">Z-Score</SelectItem>
              <SelectItem value="modified_zscore">Modified Z-Score</SelectItem>
              <SelectItem value="iqr">IQR (Interquartile Range)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sensitivity">Sensitivity Level</Label>
          <Select
            value={formData.sensitivity}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, sensitivity: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="windowSize">Window Size</Label>
          <Input
            id="windowSize"
            type="number"
            value={formData.windowSize}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, windowSize: Number.parseInt(e.target.value) }))
            }
            min="10"
            max="1000"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="threshold">Detection Threshold: {formData.threshold}</Label>
        <Slider
          id="threshold"
          min={0.1}
          max={1.0}
          step={0.01}
          value={[formData.threshold]}
          onValueChange={([value]) => setFormData((prev) => ({ ...prev, threshold: value }))}
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="alertThreshold">Alert Threshold: {formData.alertThreshold}</Label>
        <Slider
          id="alertThreshold"
          min={0.1}
          max={1.0}
          step={0.01}
          value={[formData.alertThreshold]}
          onValueChange={([value]) => setFormData((prev) => ({ ...prev, alertThreshold: value }))}
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="minSamples">Minimum Samples</Label>
        <Input
          id="minSamples"
          type="number"
          value={formData.minSamples}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, minSamples: Number.parseInt(e.target.value) }))
          }
          min="5"
          max="100"
          required
        />
      </div>

      <div>
        <Label htmlFor="features">Features to Monitor</Label>
        <Textarea
          id="features"
          value={formData.features.join(", ")}
          onChange={(e) => handleFeaturesChange(e.target.value)}
          placeholder="request_rate, response_time, error_rate"
          rows={3}
        />
        <div className="mt-2 text-sm text-muted-foreground">
          Available features: {availableFeatures.join(", ")}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="enabled"
          checked={formData.enabled}
          onCheckedChange={(enabled) => setFormData((prev) => ({ ...prev, enabled }))}
        />
        <Label htmlFor="enabled">Enable this configuration</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Configuration"}
        </Button>
      </DialogFooter>
    </form>
  );
}
