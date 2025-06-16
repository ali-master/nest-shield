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

type RateLimitConfigProps = {
  config?: any;
  onSave: (config: any) => void;
  onCancel: () => void;
  loading: boolean;
};

export function RateLimitConfig({ config, onSave, onCancel, loading }: RateLimitConfigProps) {
  const [formData, setFormData] = useState({
    name: config?.name || "",
    path: config?.path || "/api/*",
    method: config?.method || "ALL",
    windowMs: config?.windowMs || 60000,
    maxRequests: config?.maxRequests || 100,
    enabled: config?.enabled ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
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
            placeholder="API Rate Limit"
            required
          />
        </div>
        <div>
          <Label htmlFor="method">HTTP Method</Label>
          <Select
            value={formData.method}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, method: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Methods</SelectItem>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="path">Path Pattern</Label>
        <Input
          id="path"
          value={formData.path}
          onChange={(e) => setFormData((prev) => ({ ...prev, path: e.target.value }))}
          placeholder="/api/*"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="maxRequests">Max Requests</Label>
          <Input
            id="maxRequests"
            type="number"
            value={formData.maxRequests}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, maxRequests: Number.parseInt(e.target.value) }))
            }
            min="1"
            required
          />
        </div>
        <div>
          <Label htmlFor="windowMs">Time Window (ms)</Label>
          <Input
            id="windowMs"
            type="number"
            value={formData.windowMs}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, windowMs: Number.parseInt(e.target.value) }))
            }
            min="1000"
            required
          />
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
