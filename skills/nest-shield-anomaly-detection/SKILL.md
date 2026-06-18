---
name: nest-shield-anomaly-detection
description: Set up @usex/nest-shield AI anomaly detection in a NestJS app — feed metrics to detectors (KNN, Isolation Forest, Z-Score, seasonal, threshold, composite) and act on detected anomalies. Use whenever the user wants to detect anomalies, outliers, spikes, or unusual traffic/metric patterns; flag suspicious behavior or attacks via ML; score metrics for abnormality; or configure/inject AnomalyDetectionService and its detectors — even if they don't name the library.
---

# NestShield anomaly detection

The anomaly-detection subsystem scores numeric metric streams (latency, error rate, request volume, custom business metrics) and returns the points it judges abnormal. You feed it `IAnomalyData` samples; it returns `IAnomaly[]`. A **detector** is the algorithm doing the judging — pick one to match your data, or run several behind the **composite** detector.

This is separate from the request-protection guard (rate limit / circuit breaker / overload). For those, use the `nest-shield-protection` skill. Anomaly detection is analysis you call from your own code; it does not block requests by itself.

## Choosing a detector

| Detector type | Best for | Cost |
|---------------|----------|------|
| `zscore` | roughly normal data, fast online scoring | very low |
| `threshold` | hard min/max bounds you already know | trivial |
| `seasonal` | metrics with daily/weekly cycles | medium |
| `isolation-forest` | multi-feature / high-dimensional outliers | medium |
| `knn` | distance-based outliers, tunable neighborhood | medium |
| `machine-learning` | learned models over historical data | higher |
| `statistical` | classic stats (IQR, etc.) | low |
| `composite` | combine the above with voting/weighting for robustness | sum of members |

Default to `zscore` for a single simple metric; default to `composite` when false positives are costly and you can afford several detectors.

## Workflow

### 1. Make the service available

Import `AnomalyDetectionModule` in the module that needs detection. It self-wires its event emitter and scheduler:

```typescript
import { Module } from "@nestjs/common";
import { AnomalyDetectionModule } from "@usex/nest-shield";

@Module({ imports: [AnomalyDetectionModule] })
export class MonitoringModule {}
```

The module exports the service under the token `DI_TOKENS.ANOMALY_DETECTION_SERVICE`.

**Done when** the app boots and the module's providers resolve.

### 2. Inject the service

Use the `InjectAnomalyDetection()` helper (or `@Inject(DI_TOKENS.ANOMALY_DETECTION_SERVICE)`):

```typescript
import { Injectable } from "@nestjs/common";
import { InjectAnomalyDetection, AnomalyDetectionService } from "@usex/nest-shield";

@Injectable()
export class MetricsMonitor {
  constructor(@InjectAnomalyDetection() private readonly anomaly: AnomalyDetectionService) {}
}
```

### 3. (Optional) select / configure the detector

The active detector is `composite` by default. Switch or tune it:

```typescript
await this.anomaly.switchDetector("knn");
await this.anomaly.configure({
  /* detector + threshold/sensitivity options */
});
```

### 4. Feed samples and act on results

Build `IAnomalyData` points and call `detectAnomalies`. Each datum needs at least `metricName`, `value`, and `timestamp`:

```typescript
const samples = [
  { metricName: "api.latency_ms", value: responseTime, timestamp: Date.now(), source: "api" },
];

const anomalies = await this.anomaly.detectAnomalies(samples);

for (const a of anomalies) {
  // a: { id, type, severity, score (0-1), confidence (0-1),
  //      actualValue, expectedValue?, deviation, description, ... }
  if (a.severity === "critical") await this.alerting.notify(a);
}
```

`detectAnomalies` returns `[]` when nothing is abnormal — the empty result is the common, healthy case, not an error.

**Done when** you've fed real (or realistic) samples and confirmed normal data returns `[]` while an injected spike returns at least one `IAnomaly` with a plausible `score`/`severity`.

### 5. Inspect status (optional)

```typescript
await this.anomaly.getSystemStatus();          // active detector + health
await this.anomaly.getDetectionReport(name?);  // per-detector report
```

## Key types

```typescript
interface IAnomalyData {
  metricName: string;
  value: number;
  timestamp: number;       // ms epoch
  type?: string;
  source?: string;
  labels?: Record<string, string>;
  metadata?: Record<string, any>;
}

interface IAnomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;   // e.g. low | medium | high | critical
  score: number;               // 0-1, how anomalous
  confidence: number;          // 0-1, detector confidence
  actualValue: number;
  expectedValue?: number;
  deviation: number;
  description: string;
  data: IAnomalyData;
  timestamp: number;
}
```

Service methods: `detectAnomalies(data, context?)`, `configure(config)`, `switchDetector(type)`, `getSystemStatus()`, `getDetectionReport(name?)`.

## Pitfalls

- **Too little history** — distance/statistical detectors (`knn`, `zscore`, `isolation-forest`) need a baseline before scores are meaningful. Feed normal data first, or expect noisy early results.
- **Treating it as a guard** — detection scores metrics; it does not reject requests. Wire your own response (alert, raise a circuit-breaker, tighten a rate limit) on the returned anomalies.
- **Mismatched detector** — `zscore` on strongly seasonal data flags every daily peak. Use `seasonal` (or `composite`) when the metric has cycles.
