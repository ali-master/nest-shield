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

type ThrottleConfigProps = {
  config?: any;
  onSave: (config: any) => void;
  onCancel: () => void;
  loading: boolean;
};

export function ThrottleConfig({ config, onSave, onCancel, loading }: ThrottleConfigProps) {
  const [formData, setFormData] = useState({
    name: config?.name || "",
    path: config?.path || "/api/*",
    method: config?.method || "ALL",
    ttl: config?.ttl || 60000,
    limit: config?.limit || 5,
    skipSuccessfulRequests: config?.skipSuccessfulRequests ?? false,
    skipFailedRequests: config?.skipFailedRequests ?? false,
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
            placeholder="Heavy Operation Throttle"
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
          placeholder="/api/heavy/*"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="limit">Request Limit</Label>
          <Input
            id="limit"
            type="number"
            value={formData.limit}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, limit: Number.parseInt(e.target.value) }))
            }
            min="1"
            required
          />
        </div>
        <div>
          <Label htmlFor="ttl">Time to Live (ms)</Label>
          <Input
            id="ttl"
            type="number"
            value={formData.ttl}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, ttl: Number.parseInt(e.target.value) }))
            }
            min="1000"
            required
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Switch
            id="skipSuccessfulRequests"
            checked={formData.skipSuccessfulRequests}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, skipSuccessfulRequests: checked }))
            }
          />
          <Label htmlFor="skipSuccessfulRequests">Skip successful requests</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="skipFailedRequests"
            checked={formData.skipFailedRequests}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, skipFailedRequests: checked }))
            }
          />
          <Label htmlFor="skipFailedRequests">Skip failed requests</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="enabled"
            checked={formData.enabled}
            onCheckedChange={(enabled) => setFormData((prev) => ({ ...prev, enabled }))}
          />
          <Label htmlFor="enabled">Enable this configuration</Label>
        </div>
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
