import { Injectable } from "@nestjs/common";

/**
 * Efficient percentile calculation using quantile sketches
 * Suitable for high-throughput scenarios where exact percentiles aren't required
 */
@Injectable()
export class PercentileAggregator {
  private sketches: Map<string, QuantileSketch> = new Map();

  addValue(key: string, value: number): void {
    if (!this.sketches.has(key)) {
      this.sketches.set(key, new QuantileSketch());
    }
    this.sketches.get(key)!.insert(value);
  }

  getPercentile(key: string, percentile: number): number | null {
    const sketch = this.sketches.get(key);
    if (!sketch) return null;
    return sketch.getQuantile(percentile / 100);
  }

  getPercentiles(
    key: string,
    percentiles: number[] = [50, 90, 95, 99],
  ): Record<string, number | null> {
    const result: Record<string, number | null> = {};

    percentiles.forEach((p) => {
      result[`p${p}`] = this.getPercentile(key, p);
    });

    return result;
  }

  getCount(key: string): number {
    const sketch = this.sketches.get(key);
    return sketch?.getCount() || 0;
  }

  getMin(key: string): number | null {
    const sketch = this.sketches.get(key);
    return sketch?.getMin() || null;
  }

  getMax(key: string): number | null {
    const sketch = this.sketches.get(key);
    return sketch?.getMax() || null;
  }

  reset(key: string): void {
    this.sketches.delete(key);
  }

  resetAll(): void {
    this.sketches.clear();
  }
}

/**
 * Simple quantile sketch implementation
 * In production, you might want to use a more sophisticated algorithm like T-Digest
 */
class QuantileSketch {
  private values: number[] = [];
  private maxSize: number;
  private sorted: boolean = true;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  insert(value: number): void {
    if (this.values.length === 0 || value >= this.values[this.values.length - 1]) {
      this.values.push(value);
    } else {
      this.values.push(value);
      this.sorted = false;
    }

    // Compress if we exceed max size
    if (this.values.length > this.maxSize) {
      this.compress();
    }
  }

  getQuantile(q: number): number | null {
    if (this.values.length === 0) return null;
    if (q <= 0) return this.getMin();
    if (q >= 1) return this.getMax();

    this.ensureSorted();

    const index = q * (this.values.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return this.values[lower];
    }

    // Linear interpolation
    const fraction = index - lower;
    return this.values[lower] * (1 - fraction) + this.values[upper] * fraction;
  }

  getCount(): number {
    return this.values.length;
  }

  getMin(): number | null {
    if (this.values.length === 0) return null;
    this.ensureSorted();
    return this.values[0];
  }

  getMax(): number | null {
    if (this.values.length === 0) return null;
    this.ensureSorted();
    return this.values[this.values.length - 1];
  }

  private ensureSorted(): void {
    if (!this.sorted) {
      this.values.sort((a, b) => a - b);
      this.sorted = true;
    }
  }

  private compress(): void {
    this.ensureSorted();

    // Simple compression: keep every nth value
    const compressionRatio = 0.5;
    const newSize = Math.floor(this.maxSize * compressionRatio);
    const step = this.values.length / newSize;

    const compressed: number[] = [];
    for (let i = 0; i < newSize; i++) {
      const index = Math.floor(i * step);
      compressed.push(this.values[index]);
    }

    // Always keep min and max
    if (compressed[0] !== this.values[0]) {
      compressed[0] = this.values[0];
    }
    if (compressed[compressed.length - 1] !== this.values[this.values.length - 1]) {
      compressed[compressed.length - 1] = this.values[this.values.length - 1];
    }

    this.values = compressed;
    this.sorted = true;
  }
}
