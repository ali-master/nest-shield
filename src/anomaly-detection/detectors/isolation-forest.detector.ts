import { Injectable } from "@nestjs/common";
import { BaseAnomalyDetector } from "./base.detector";
import { IAnomalyData, IAnomaly, AnomalyType } from "../interfaces/anomaly.interface";
import { IDetectorContext } from "../interfaces/detector.interface";

@Injectable()
export class IsolationForestDetector extends BaseAnomalyDetector {
  readonly name = "Isolation Forest Detector";
  readonly version = "1.0.0";
  readonly description = "Unsupervised anomaly detection using Isolation Forest algorithm";

  private trees: IsolationTree[] = [];
  private featureExtractor: FeatureExtractor;
  private trained = false;

  constructor() {
    super();
    this.featureExtractor = new FeatureExtractor();
  }

  async detect(data: IAnomalyData[], context?: IDetectorContext): Promise<IAnomaly[]> {
    if (!this.isReady() || data.length === 0 || !this.trained) {
      return [];
    }

    const anomalies: IAnomaly[] = [];

    for (const dataPoint of data) {
      if (this.isMaintenanceWindow(dataPoint.timestamp, context)) {
        continue;
      }

      const anomaly = await this.detectSinglePoint(dataPoint, context);
      if (anomaly) {
        const processedAnomaly = this.applyBusinessRules(anomaly);
        if (processedAnomaly) {
          anomalies.push(processedAnomaly);
        }
      }
    }

    return anomalies;
  }

  private async detectSinglePoint(
    dataPoint: IAnomalyData,
    context?: IDetectorContext,
  ): Promise<IAnomaly | null> {
    const features = this.featureExtractor.extract(dataPoint, context);
    const isolationScore = this.calculateIsolationScore(features);

    // Convert isolation score to anomaly score (lower isolation score = higher anomaly)
    const anomalyScore = 1 - isolationScore;

    if (anomalyScore < this.config.threshold) {
      return null;
    }

    // Determine anomaly type based on feature characteristics
    const anomalyType = this.determineAnomalyType(features, dataPoint);

    // Calculate confidence based on score consistency across trees
    const confidence = this.calculateConfidence(features);

    const description =
      `Isolation Forest anomaly detected: isolation_score=${isolationScore.toFixed(3)}, ` +
      `features=[${features
        .slice(0, 3)
        .map((f) => f.toFixed(2))
        .join(", ")}...]`;

    return this.createAnomaly(dataPoint, anomalyType, anomalyScore, confidence, description);
  }

  private calculateIsolationScore(features: number[]): number {
    if (this.trees.length === 0) return 0.5;

    const pathLengths = this.trees.map((tree) => tree.getPathLength(features));
    const avgPathLength = pathLengths.reduce((sum, len) => sum + len, 0) / pathLengths.length;

    // Normalize path length to isolation score (0-1)
    const c = this.calculateC(this.config.windowSize);
    return Math.pow(2, -avgPathLength / c);
  }

  private calculateC(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
  }

  private calculateConfidence(features: number[]): number {
    const pathLengths = this.trees.map((tree) => tree.getPathLength(features));
    const mean = pathLengths.reduce((sum, len) => sum + len, 0) / pathLengths.length;
    const variance =
      pathLengths.reduce((sum, len) => sum + Math.pow(len - mean, 2), 0) / pathLengths.length;
    const stdDev = Math.sqrt(variance);

    // Lower variance = higher confidence
    const consistencyScore = Math.max(0, 1 - stdDev / mean);

    // Base confidence with consistency adjustment
    return Math.min(0.5 + consistencyScore * 0.5, 1);
  }

  private determineAnomalyType(features: number[], dataPoint: IAnomalyData): AnomalyType {
    // Analyze feature deviations to determine anomaly type
    const deviations = features.map((f, i) => Math.abs(f - this.getFeatureMean(i)));
    const maxDeviationIndex = deviations.indexOf(Math.max(...deviations));

    // Map feature index to anomaly type based on feature semantics
    switch (maxDeviationIndex) {
      case 0: // Value-based features
        return dataPoint.value > this.getFeatureMean(0) ? AnomalyType.SPIKE : AnomalyType.DROP;
      case 1: // Rate-based features
        return AnomalyType.TREND;
      case 2: // Variance-based features
        return AnomalyType.OUTLIER;
      default:
        return AnomalyType.OUTLIER;
    }
  }

  private getFeatureMean(index: number): number {
    // Calculate mean for specific feature across training data
    return this.featureExtractor.getFeatureMean(index);
  }

  protected async performTraining(data: IAnomalyData[]): Promise<void> {
    this.logger.log(`Training Isolation Forest with ${data.length} samples`);

    // Extract features from training data
    const features = data.map((d) => this.featureExtractor.extract(d));
    this.featureExtractor.fit(features);

    // Build isolation trees
    const numTrees = Math.min(100, Math.max(10, Math.floor(data.length / 10)));
    const subsampleSize = Math.min(256, Math.floor(data.length * 0.8));

    this.trees = [];
    for (let i = 0; i < numTrees; i++) {
      const subsample = this.subsample(features, subsampleSize);
      const tree = new IsolationTree(this.config.maxDepth || 10);
      tree.build(subsample);
      this.trees.push(tree);
    }

    this.trained = true;
    this.logger.log(`Isolation Forest trained with ${numTrees} trees`);
  }

  private subsample(data: number[][], size: number): number[][] {
    const shuffled = [...data].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, size);
  }

  reset(): void {
    super.reset();
    this.trees = [];
    this.trained = false;
    this.featureExtractor.reset();
  }

  // Advanced isolation forest methods

  getAnomalyScores(data: IAnomalyData[]): number[] {
    return data.map((d) => {
      const features = this.featureExtractor.extract(d);
      return 1 - this.calculateIsolationScore(features);
    });
  }

  getFeatureImportance(): Record<string, number> {
    const importance: Record<string, number> = {};
    const featureNames = this.featureExtractor.getFeatureNames();

    // Calculate feature importance based on split frequency
    featureNames.forEach((name, index) => {
      const splitCount = this.trees.reduce(
        (count, tree) => count + tree.getFeatureSplitCount(index),
        0,
      );
      importance[name] = splitCount / (this.trees.length * this.trees[0]?.getNodeCount() || 1);
    });

    return importance;
  }

  getTreeStats(): ITreeStats {
    return {
      numTrees: this.trees.length,
      avgDepth: this.trees.reduce((sum, tree) => sum + tree.getDepth(), 0) / this.trees.length,
      avgNodeCount:
        this.trees.reduce((sum, tree) => sum + tree.getNodeCount(), 0) / this.trees.length,
    };
  }
}

class IsolationTree {
  private root: IsolationNode | null = null;
  private maxDepth: number;

  constructor(maxDepth = 10) {
    this.maxDepth = maxDepth;
  }

  build(data: number[][]): void {
    this.root = this.buildNode(data, 0);
  }

  private buildNode(data: number[][], depth: number): IsolationNode {
    if (data.length <= 1 || depth >= this.maxDepth) {
      return new IsolationNode(data.length, true);
    }

    // Random feature selection
    const featureIndex = Math.floor(Math.random() * data[0].length);
    const featureValues = data.map((row) => row[featureIndex]);
    const minVal = Math.min(...featureValues);
    const maxVal = Math.max(...featureValues);

    if (minVal === maxVal) {
      return new IsolationNode(data.length, true);
    }

    // Random split point
    const splitValue = minVal + Math.random() * (maxVal - minVal);

    const leftData = data.filter((row) => row[featureIndex] < splitValue);
    const rightData = data.filter((row) => row[featureIndex] >= splitValue);

    if (leftData.length === 0 || rightData.length === 0) {
      return new IsolationNode(data.length, true);
    }

    const node = new IsolationNode(data.length, false, featureIndex, splitValue);
    node.left = this.buildNode(leftData, depth + 1);
    node.right = this.buildNode(rightData, depth + 1);

    return node;
  }

  getPathLength(features: number[]): number {
    return this.getPathLengthRecursive(this.root, features, 0);
  }

  private getPathLengthRecursive(
    node: IsolationNode | null,
    features: number[],
    depth: number,
  ): number {
    if (!node || node.isLeaf) {
      return depth + this.calculateC(node?.size || 1);
    }

    if (features[node.featureIndex!] < node.splitValue!) {
      return this.getPathLengthRecursive(node.left, features, depth + 1);
    } else {
      return this.getPathLengthRecursive(node.right, features, depth + 1);
    }
  }

  private calculateC(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
  }

  getDepth(): number {
    return this.getDepthRecursive(this.root);
  }

  private getDepthRecursive(node: IsolationNode | null): number {
    if (!node || node.isLeaf) return 0;
    return 1 + Math.max(this.getDepthRecursive(node.left), this.getDepthRecursive(node.right));
  }

  getNodeCount(): number {
    return this.getNodeCountRecursive(this.root);
  }

  private getNodeCountRecursive(node: IsolationNode | null): number {
    if (!node) return 0;
    return 1 + this.getNodeCountRecursive(node.left) + this.getNodeCountRecursive(node.right);
  }

  getFeatureSplitCount(featureIndex: number): number {
    return this.getFeatureSplitCountRecursive(this.root, featureIndex);
  }

  private getFeatureSplitCountRecursive(node: IsolationNode | null, featureIndex: number): number {
    if (!node || node.isLeaf) return 0;

    const currentCount = node.featureIndex === featureIndex ? 1 : 0;
    return (
      currentCount +
      this.getFeatureSplitCountRecursive(node.left, featureIndex) +
      this.getFeatureSplitCountRecursive(node.right, featureIndex)
    );
  }
}

class IsolationNode {
  size: number;
  isLeaf: boolean;
  featureIndex?: number;
  splitValue?: number;
  left?: IsolationNode;
  right?: IsolationNode;

  constructor(size: number, isLeaf: boolean, featureIndex?: number, splitValue?: number) {
    this.size = size;
    this.isLeaf = isLeaf;
    this.featureIndex = featureIndex;
    this.splitValue = splitValue;
  }
}

class FeatureExtractor {
  private featureMeans: number[] = [];
  private featureStds: number[] = [];
  private featureNames = [
    "value",
    "value_normalized",
    "rate_of_change",
    "local_variance",
    "z_score",
    "moving_average_ratio",
    "percentile_rank",
    "time_since_last_spike",
  ];

  extract(dataPoint: IAnomalyData, context?: IDetectorContext): number[] {
    const features: number[] = [];

    // Basic value features
    features.push(dataPoint.value);
    features.push(this.normalizeValue(dataPoint.value));

    // Rate-based features
    features.push(this.calculateRateOfChange(dataPoint, context));
    features.push(this.calculateLocalVariance(dataPoint, context));

    // Statistical features
    features.push(this.calculateZScore(dataPoint, context));
    features.push(this.calculateMovingAverageRatio(dataPoint, context));

    // Distribution features
    features.push(this.calculatePercentileRank(dataPoint, context));
    features.push(this.calculateTimeSinceLastSpike(dataPoint, context));

    return features;
  }

  private normalizeValue(value: number): number {
    // Min-Max normalization based on training data
    const index = 0;
    if (this.featureMeans.length > index && this.featureStds.length > index) {
      return (value - this.featureMeans[index]) / (this.featureStds[index] || 1);
    }
    return value;
  }

  private calculateRateOfChange(dataPoint: IAnomalyData, context?: IDetectorContext): number {
    // Simplified rate calculation - in production, use historical data
    return Math.random() * 2 - 1; // Placeholder
  }

  private calculateLocalVariance(dataPoint: IAnomalyData, context?: IDetectorContext): number {
    // Simplified variance calculation
    return Math.random(); // Placeholder
  }

  private calculateZScore(dataPoint: IAnomalyData, context?: IDetectorContext): number {
    // Simplified Z-score calculation
    return Math.random() * 6 - 3; // Placeholder
  }

  private calculateMovingAverageRatio(dataPoint: IAnomalyData, context?: IDetectorContext): number {
    // Simplified moving average ratio
    return Math.random() * 2; // Placeholder
  }

  private calculatePercentileRank(dataPoint: IAnomalyData, context?: IDetectorContext): number {
    // Simplified percentile rank
    return Math.random(); // Placeholder
  }

  private calculateTimeSinceLastSpike(dataPoint: IAnomalyData, context?: IDetectorContext): number {
    // Simplified time calculation
    return Math.random() * 3600000; // Placeholder
  }

  fit(features: number[][]): void {
    if (features.length === 0) return;

    const numFeatures = features[0].length;
    this.featureMeans = new Array(numFeatures).fill(0);
    this.featureStds = new Array(numFeatures).fill(0);

    // Calculate means
    for (let i = 0; i < numFeatures; i++) {
      const values = features.map((f) => f[i]);
      this.featureMeans[i] = values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    // Calculate standard deviations
    for (let i = 0; i < numFeatures; i++) {
      const values = features.map((f) => f[i]);
      const variance =
        values.reduce((sum, val) => sum + Math.pow(val - this.featureMeans[i], 2), 0) /
        values.length;
      this.featureStds[i] = Math.sqrt(variance);
    }
  }

  getFeatureMean(index: number): number {
    return this.featureMeans[index] || 0;
  }

  getFeatureNames(): string[] {
    return [...this.featureNames];
  }

  reset(): void {
    this.featureMeans = [];
    this.featureStds = [];
  }
}

interface ITreeStats {
  numTrees: number;
  avgDepth: number;
  avgNodeCount: number;
}
