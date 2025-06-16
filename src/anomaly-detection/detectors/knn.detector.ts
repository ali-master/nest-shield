import { Injectable } from "@nestjs/common";
import { BaseAnomalyDetector } from "./base.detector";
import { IDetectorContext, IDetectorConfig } from "../interfaces/detector.interface";
import { IAnomalyData, IAnomaly, AnomalyType } from "../interfaces/anomaly.interface";

export interface IKNNDetectorConfig extends IDetectorConfig {
  k?: number; // Number of neighbors
  distanceMetric?: "euclidean" | "manhattan" | "cosine";
  anomalyThreshold?: number; // Distance threshold for anomaly
  normalizeData?: boolean;
  maxTrainingSize?: number; // Maximum training samples to keep
  minTrainingSamples?: number; // Minimum samples needed for training
  dynamicK?: boolean; // Adjust K based on dataset size
  weightedVoting?: boolean; // Use distance-weighted voting
}

interface TrainingSample {
  value: number;
  timestamp: number;
  normalizedValue?: number;
}

@Injectable()
export class KNNDetector extends BaseAnomalyDetector {
  readonly name = "K-Nearest Neighbors Detector";
  readonly version = "1.0.0";
  readonly description =
    "Detects anomalies using K-Nearest Neighbors algorithm with optimized performance";

  private trainingData: TrainingSample[] = [];
  private knnConfig: IKNNDetectorConfig = {
    k: 5,
    distanceMetric: "euclidean",
    anomalyThreshold: 2.0,
    normalizeData: true,
    maxTrainingSize: 10000,
    minTrainingSamples: 20,
    dynamicK: true,
    weightedVoting: true,
    enabled: true,
    sensitivity: 0.8,
    threshold: 0.7,
    windowSize: 100,
    minDataPoints: 20,
  };

  // Cache for performance optimization
  private normalizationParams: { mean: number; std: number } | null = null;

  constructor() {
    super();
    this.configure(this.knnConfig);
  }

  configure(config: Partial<IKNNDetectorConfig>): void {
    this.knnConfig = { ...this.knnConfig, ...config };
    super.configure(this.knnConfig);
    // Invalidate cache on configuration change
  }

  async detect(data: IAnomalyData[], _context?: IDetectorContext): Promise<IAnomaly[]> {
    if (!this.isReady() || this.trainingData.length < this.knnConfig.minTrainingSamples!) {
      return [];
    }

    const anomalies: IAnomaly[] = [];

    for (const item of data) {
      const distance = this.calculateAnomalyScore(item.value);
      const isAnomaly = distance > this.knnConfig.anomalyThreshold!;

      if (isAnomaly) {
        // Calculate confidence based on distance and k-neighbors agreement
        const confidence = this.calculateConfidence(distance);

        anomalies.push(
          this.createAnomaly(
            item,
            AnomalyType.OUTLIER,
            distance,
            confidence,
            `KNN anomaly detected: distance=${distance.toFixed(3)}, k=${this.getEffectiveK()}`,
          ),
        );
      }

      // Add to training data for continuous learning
      if (this.trainingData.length < this.knnConfig.maxTrainingSize!) {
        this.addTrainingSample(item);
      }
    }

    return anomalies;
  }

  protected async performTraining(data: IAnomalyData[]): Promise<void> {
    // Clear existing training data
    this.trainingData = [];
    this.normalizationParams = null;

    // Convert and store training samples
    for (const item of data) {
      if (this.trainingData.length >= this.knnConfig.maxTrainingSize!) {
        break;
      }
      this.addTrainingSample(item);
    }

    // Calculate normalization parameters if enabled
    if (this.knnConfig.normalizeData && this.trainingData.length > 0) {
      const values = this.trainingData.map((s) => s.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
      const std = Math.sqrt(variance);

      this.normalizationParams = { mean, std: std || 1 };

      // Normalize training data
      for (const sample of this.trainingData) {
        sample.normalizedValue = this.normalize(sample.value);
      }
    }

    this.ready = this.trainingData.length >= this.knnConfig.minTrainingSamples!;
  }

  reset(): void {
    super.reset();
    this.trainingData = [];
    this.normalizationParams = null;
  }

  private addTrainingSample(data: IAnomalyData): void {
    const sample: TrainingSample = {
      value: data.value,
      timestamp: data.timestamp,
    };

    if (this.knnConfig.normalizeData && this.normalizationParams) {
      sample.normalizedValue = this.normalize(data.value);
    }

    this.trainingData.push(sample);
  }

  private calculateAnomalyScore(value: number): number {
    const normalizedValue = this.knnConfig.normalizeData ? this.normalize(value) : value;
    const k = this.getEffectiveK();

    // Get k nearest neighbors efficiently
    const neighbors = this.getKNearestNeighbors(normalizedValue, k);

    if (neighbors.length === 0) {
      return Infinity;
    }

    // Calculate average distance with optional weighting
    if (this.knnConfig.weightedVoting) {
      // Distance-weighted average
      let weightedSum = 0;
      let weightSum = 0;

      for (const neighbor of neighbors) {
        const weight = 1 / (1 + neighbor.distance); // Inverse distance weighting
        weightedSum += neighbor.distance * weight;
        weightSum += weight;
      }

      return weightSum > 0 ? weightedSum / weightSum : 0;
    } else {
      // Simple average
      const sum = neighbors.reduce((acc, n) => acc + n.distance, 0);
      return sum / neighbors.length;
    }
  }

  private getKNearestNeighbors(
    value: number,
    k: number,
  ): Array<{ distance: number; sample: TrainingSample }> {
    const distances: Array<{ distance: number; sample: TrainingSample }> = [];

    // Calculate distances to all training samples
    for (const sample of this.trainingData) {
      const sampleValue = this.knnConfig.normalizeData ? sample.normalizedValue! : sample.value;
      const distance = this.calculateDistance(value, sampleValue);
      distances.push({ distance, sample });
    }

    // Use partial sort for better performance with large datasets
    return this.partialSort(distances, k);
  }

  private calculateDistance(a: number, b: number): number {
    switch (this.knnConfig.distanceMetric) {
      case "manhattan":
        return Math.abs(a - b);
      case "cosine":
        // For single values, cosine distance simplifies
        return 1 - (a * b) / (Math.sqrt(a * a) * Math.sqrt(b * b));
      case "euclidean":
      default:
        return Math.abs(a - b); // For 1D, euclidean = absolute difference
    }
  }

  private normalize(value: number): number {
    if (!this.normalizationParams) {
      return value;
    }
    return (value - this.normalizationParams.mean) / this.normalizationParams.std;
  }

  private getEffectiveK(): number {
    if (!this.knnConfig.dynamicK) {
      return this.knnConfig.k!;
    }

    // Adjust K based on training data size
    const dataSize = this.trainingData.length;
    const sqrtSize = Math.sqrt(dataSize);
    const dynamicK = Math.min(this.knnConfig.k!, Math.max(3, Math.floor(sqrtSize)));

    return dynamicK;
  }

  private calculateConfidence(distance: number): number {
    // Confidence decreases as distance increases
    const normalizedDistance = distance / this.knnConfig.anomalyThreshold!;
    const confidence = Math.exp(-normalizedDistance) * this.knnConfig.sensitivity!;
    return Math.max(0, Math.min(1, confidence));
  }

  // Optimized partial sort using quickselect algorithm
  private partialSort<T>(
    arr: Array<{ distance: number; sample: T }>,
    k: number,
  ): Array<{ distance: number; sample: T }> {
    if (arr.length <= k) {
      return arr.sort((a, b) => a.distance - b.distance);
    }

    // Clone array to avoid mutation
    const items = [...arr];
    const n = items.length;
    k = Math.min(k, n);

    // Quickselect to find k smallest elements
    this.quickselect(items, k, 0, n - 1);

    // Take first k elements and sort them
    return items.slice(0, k).sort((a, b) => a.distance - b.distance);
  }

  private quickselect<T>(
    arr: Array<{ distance: number; sample: T }>,
    k: number,
    left: number,
    right: number,
  ): void {
    while (left < right) {
      const pivotIndex = this.partition(arr, left, right);

      if (pivotIndex === k - 1) {
        return;
      } else if (pivotIndex < k - 1) {
        left = pivotIndex + 1;
      } else {
        right = pivotIndex - 1;
      }
    }
  }

  private partition<T>(
    arr: Array<{ distance: number; sample: T }>,
    left: number,
    right: number,
  ): number {
    const pivot = arr[right].distance;
    let i = left;

    for (let j = left; j < right; j++) {
      if (arr[j].distance <= pivot) {
        [arr[i], arr[j]] = [arr[j], arr[i]];
        i++;
      }
    }

    [arr[i], arr[right]] = [arr[right], arr[i]];
    return i;
  }

  // Get detector statistics for monitoring
  getStatistics(): Record<string, any> {
    return {
      name: this.name,
      version: this.version,
      trained: this.isReady(),
      trainingDataSize: this.trainingData.length,
      config: this.knnConfig,
      normalizationParams: this.normalizationParams,
      effectiveK: this.getEffectiveK(),
    };
  }
}
