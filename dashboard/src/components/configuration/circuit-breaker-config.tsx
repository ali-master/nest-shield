"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type CircuitBreakerConfigProps = {
  config?: any;
  onSave: (config: any) => void;
  onCancel: () => void;
  loading: boolean;
};

export function CircuitBreakerConfig({
  config,
  onSave,
  onCancel,
  loading,
}: CircuitBreakerConfigProps) {
  const [formData, setFormData] = useState({
    name: config?.name || "",
    service: config?.service || "",
    failureThreshold: config?.failureThreshold || 5,
    recoveryTimeout: config?.recoveryTimeout || 30000,
    monitoringPeriod: config?.monitoringPeriod || 60000,
    fallbackMethod: config?.fallbackMethod || "",
    errorTypes: config?.errorTypes || ["Error", "TimeoutError"],
    enabled: config?.enabled ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleErrorTypesChange = (value: string) => {
    const types = value
      .split(",")
      .map((type) => type.trim())
      .filter(Boolean);
    setFormData((prev) => ({ ...prev, errorTypes: types }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Configuration Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Database Circuit Breaker"
            required
          />
        </div>
        <div>
          <Label htmlFor="service">Service Name</Label>
          <Input
            id="service"
            value={formData.service}
            onChange={(e) => setFormData((prev) => ({ ...prev, service: e.target.value }))}
            placeholder="database"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="failureThreshold">Failure Threshold</Label>
          <Input
            id="failureThreshold"
            type="number"
            value={formData.failureThreshold}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                failureThreshold: Number.parseInt(e.target.value),
              }))
            }
            min="1"
            required
          />
        </div>
        <div>
          <Label htmlFor="recoveryTimeout">Recovery Timeout (ms)</Label>
          <Input
            id="recoveryTimeout"
            type="number"
            value={formData.recoveryTimeout}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, recoveryTimeout: Number.parseInt(e.target.value) }))
            }
            min="1000"
            required
          />
        </div>
        <div>
          <Label htmlFor="monitoringPeriod">Monitoring Period (ms)</Label>
          <Input
            id="monitoringPeriod"
            type="number"
            value={formData.monitoringPeriod}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                monitoringPeriod: Number.parseInt(e.target.value),
              }))
            }
            min="1000"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="fallbackMethod">Fallback Method (Optional)</Label>
        <Input
          id="fallbackMethod"
          value={formData.fallbackMethod}
          onChange={(e) => setFormData((prev) => ({ ...prev, fallbackMethod: e.target.value }))}
          placeholder="fallbackHandler"
        />
      </div>

      <div>
        <Label htmlFor="errorTypes">Error Types (comma-separated)</Label>
        <Textarea
          id="errorTypes"
          value={formData.errorTypes.join(", ")}
          onChange={(e) => handleErrorTypesChange(e.target.value)}
          placeholder="Error, TimeoutError, DatabaseError"
          rows={3}
        />
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
