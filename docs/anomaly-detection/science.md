# The Mathematical Science Behind NestShield's Anomaly Detection

A comprehensive exploration of the algorithms, mathematical foundations, and statistical principles powering NestShield's anomaly detection system.

## Table of Contents

1. [Introduction and Overview](#introduction)
2. [Mathematical Foundations](#mathematical-foundations)
3. [Z-Score Detector: Welford's Algorithm and Adaptive Statistics](#z-score-detector)
4. [Isolation Forest: Tree-Based Feature Engineering](#isolation-forest)
5. [Seasonal Decomposition: Multi-Scale Time Series Analysis](#seasonal-decomposition)
6. [Statistical Ensemble: Multiple Hypothesis Testing](#statistical-ensemble)
7. [Machine Learning: Autoencoders, LSTM, and One-Class SVM](#machine-learning)
8. [Composite Detection: Intelligent Ensemble Strategies](#composite-detection)
9. [Performance Analysis and Evaluation](#performance-analysis)
10. [Implementation Algorithms](#implementation-algorithms)
11. [Mathematical Complexity Analysis](#complexity-analysis)

## 1. Introduction and Overview {#introduction}

### Mathematical Definition of Anomalies

In NestShield's implementation, an anomaly is defined as a data point that deviates significantly from learned patterns. Formally:

```
Given a dataset D = {x₁, x₂, ..., xₙ} and a detector function f:

Anomaly Score: s(x) = f(x, D, θ)
An anomaly exists when: s(x) > τ (threshold)

where θ represents detector-specific parameters and τ is the sensitivity threshold.
```

### NestShield's Anomaly Types

Based on the actual implementation, NestShield detects:

1. **SPIKE**: `dataPoint.value > expectedValue + (threshold * volatility)`
2. **DROP**: `dataPoint.value < expectedValue - (threshold * volatility)`
3. **OUTLIER**: Statistical deviation from normal patterns
4. **TREND_CHANGE**: Significant change in data trend
5. **PATTERN_ANOMALY**: Contextual anomalies in time series

### Detection Framework

NestShield uses a multi-layered approach:

```typescript
// Core detection interface
interface IAnomalyDetector {
  detect(data: IAnomalyData[], context?: IDetectorContext): Promise<IAnomaly[]>;
  train(data: IAnomalyData[]): Promise<void>;
  isReady(): boolean;
}
```

### Business Rules Integration

Unique to NestShield is the integration of business logic:

```typescript
interface IBusinessRule {
  id: string;
  condition: string;  // JavaScript expression
  action: "suppress" | "escalate" | "adjust_threshold";
  reason: string;
}
```

## 2. Mathematical Foundations {#mathematical-foundations}

### Core Statistical Concepts

#### Online Statistics with Welford's Algorithm
NestShield implements numerically stable online statistics:

```typescript
// Welford's algorithm for online mean and variance
class OnlineStatistics {
  private n = 0;
  private mean = 0;
  private M2 = 0;
  
  update(x: number): void {
    this.n++;
    const delta = x - this.mean;
    this.mean += delta / this.n;
    const delta2 = x - this.mean;
    this.M2 += delta * delta2;
  }
  
  getVariance(): number {
    return this.n < 2 ? 0 : this.M2 / (this.n - 1);
  }
}
```

**Mathematical Properties:**
- **Numerical Stability**: Avoids catastrophic cancellation
- **Memory Efficiency**: O(1) space complexity
- **Computational Efficiency**: O(1) time per update

#### Median Absolute Deviation (MAD)
Used for robust outlier detection:

```
MAD = median(|xᵢ - median(X)|)
Modified Z-Score = 0.6745 × (x - median) / MAD
```

The constant 0.6745 ensures consistency with standard deviation for normal distributions.

### Severity Calculation Framework

NestShield uses a standardized severity calculation:

```typescript
protected calculateSeverity(score: number, confidence: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const adjustedScore = score * confidence;
  
  if (adjustedScore >= 0.9) return 'CRITICAL';
  if (adjustedScore >= 0.7) return 'HIGH';
  if (adjustedScore >= 0.5) return 'MEDIUM';
  return 'LOW';
}
```

### Distance Metrics in NestShield

#### Feature Space Distance (Isolation Forest)
```typescript
private calculateDistance(point1: number[], point2: number[]): number {
  return Math.sqrt(
    point1.reduce((sum, val, i) => sum + Math.pow(val - point2[i], 2), 0)
  );
}
```

#### Time-Aware Distance (Seasonal)
```typescript
private getExpectedVolatility(timestamp: number, pattern: ISeasonalPattern): number {
  const timeFeatures = this.extractTimeFeatures(timestamp);
  let volatility = pattern.baselineVolatility || 1;
  
  // Time-based volatility adjustments
  if (pattern.volatilityByHour) {
    volatility *= pattern.volatilityByHour[timeFeatures.hour] || 1;
  }
  
  return volatility;
}
```

## 3. Z-Score Detector: Welford's Algorithm and Adaptive Statistics {#z-score-detector}

### NestShield's Z-Score Implementation

NestShield's Z-Score detector implements sophisticated online learning with adaptive thresholds.

#### Core Algorithm Structure

```typescript
// From zscore.detector.ts
private async detectSinglePoint(
  dataPoint: IAnomalyData,
  context?: IDetectorContext
): Promise<IAnomaly | null> {
  // Update running statistics using Welford's algorithm
  this.updateRunningStats(dataPoint.value);
  
  // Calculate Z-Score with seasonal adjustment
  let zScore = this.calculateZScore(dataPoint.value);
  if (this.hasSeasonalAdjustment(dataPoint.timestamp)) {
    zScore = this.applySeasonalAdjustment(zScore, dataPoint.timestamp);
  }
  
  // Apply Modified Z-Score for robustness
  const modifiedZScore = this.calculateModifiedZScore(dataPoint.value);
  const finalScore = Math.max(zScore, modifiedZScore);
  
  return finalScore > this.config.threshold ? this.createAnomaly(...) : null;
}
```

#### Welford's Algorithm Implementation

**Mathematical Foundation:**
```
// Online mean update
μₙ = μₙ₋₁ + (xₙ - μₙ₋₁)/n

// Online variance update  
M₂ₙ = M₂ₙ₋₁ + (xₙ - μₙ₋₁)(xₙ - μₙ)
σ²ₙ = M₂ₙ/(n-1)
```

**Numerical Advantages:**
- Avoids loss of precision in floating-point arithmetic
- Handles large differences between data points and mean
- Maintains numerical stability even with extreme values

#### Modified Z-Score with MAD

```typescript
private calculateModifiedZScore(value: number): number {
  const median = this.rollingWindow.median();
  const mad = this.calculateMAD();
  
  if (mad === 0) return 0;
  
  // 0.6745 is the 75th percentile of the standard normal distribution
  return 0.6745 * Math.abs(value - median) / mad;
}

private calculateMAD(): number {
  const median = this.rollingWindow.median();
  const deviations = this.rollingWindow.values.map(x => Math.abs(x - median));
  return this.median(deviations);
}
```

#### Adaptive Threshold Mechanism

```typescript
private calculateAdaptiveThreshold(
  baseThreshold: number,
  recentVolatility: number,
  trendStrength: number
): number {
  // Adjust threshold based on recent volatility
  let adaptiveThreshold = baseThreshold * (1 + recentVolatility * 0.5);
  
  // Reduce threshold during trend changes (more sensitive)
  if (trendStrength > 0.7) {
    adaptiveThreshold *= 0.8;
  }
  
  return Math.max(adaptiveThreshold, baseThreshold * 0.5);
}
```

#### Seasonal Adjustment Formula

```typescript
private applySeasonalAdjustment(zScore: number, timestamp: number): number {
  const timeFeatures = this.extractTimeFeatures(timestamp);
  
  // Get expected variance for this time period
  const expectedVolatility = this.seasonalVolatility[timeFeatures.hour] || 1.0;
  
  // Adjust Z-score by expected volatility
  return zScore / Math.sqrt(expectedVolatility);
}
```

### Statistical Properties

#### Convergence Guarantees

For the online mean and variance:
```
lim(n→∞) μₙ = E[X]  (almost surely)
lim(n→∞) σ²ₙ = Var[X]  (almost surely)
```

#### Confidence Intervals

For anomaly scores, NestShield calculates confidence based on:
```typescript
private calculateConfidence(
  zScore: number,
  sampleSize: number,
  dataAge: number
): number {
  let confidence = Math.min(zScore / 5.0, 1.0); // Base confidence from z-score
  
  // Increase confidence with more data
  const sampleFactor = Math.min(sampleSize / 100, 1.0);
  confidence *= (0.5 + 0.5 * sampleFactor);
  
  // Decrease confidence for old data
  const ageFactor = Math.exp(-dataAge / (24 * 60 * 60 * 1000)); // 24-hour decay
  confidence *= ageFactor;
  
  return confidence;
}
```

### Performance Characteristics

- **Time Complexity**: O(1) per data point
- **Space Complexity**: O(w) where w is window size
- **Numerical Stability**: High (Welford's algorithm)
- **Convergence Rate**: O(1/√n) for variance estimation

## 4. Isolation Forest: Tree-Based Isolation {#isolation-forest}

### The Isolation Principle

Isolation Forest operates on the principle that anomalies are "few and different," making them easier to isolate.

#### Key Insight
Anomalies require fewer random partitions to be isolated compared to normal points.

### Mathematical Framework

#### Isolation Tree Construction
Given dataset X with n points:

1. **Random Split Selection**:
   ```
   Select random feature q ∈ {1, ..., d}
   Select random split value p between min(X[q]) and max(X[q])
   ```

2. **Partitioning**:
   ```
   X_left = {x ∈ X : x[q] < p}
   X_right = {x ∈ X : x[q] ≥ p}
   ```

3. **Path Length**:
   ```
   h(x) = number of edges from root to leaf containing x
   ```

#### Anomaly Score Computation

The anomaly score for a point x:

```
s(x, n) = 2^(-E(h(x))/c(n))
```

where:
- E(h(x)) = expected path length over all trees
- c(n) = average path length of unsuccessful BST search:
  ```
  c(n) = 2H(n-1) - (2(n-1)/n)
  H(i) = ln(i) + γ (Euler's constant ≈ 0.5772)
  ```

### Implementation Algorithm

```typescript
class IsolationTree {
  build(data: number[][], height: number, maxHeight: number): IsolationNode {
    if (height >= maxHeight || data.length <= 1) {
      return new LeafNode(data.length);
    }
    
    // Random feature and split
    const feature = Math.floor(Math.random() * data[0].length);
    const values = data.map(row => row[feature]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const splitValue = min + Math.random() * (max - min);
    
    // Partition data
    const left = data.filter(row => row[feature] < splitValue);
    const right = data.filter(row => row[feature] >= splitValue);
    
    return new InternalNode(
      feature,
      splitValue,
      this.build(left, height + 1, maxHeight),
      this.build(right, height + 1, maxHeight)
    );
  }
}
```

### Why Isolation Forest Works

1. **Linear Time Complexity**: O(n log n) for building, O(log n) for scoring
2. **No Distance Calculations**: Doesn't rely on distance metrics
3. **Handles High Dimensions**: Performs well in high-dimensional spaces
4. **Swamping Resistance**: Less affected by masking effects

### Mathematical Properties

#### Expected Isolation Depth
For uniformly distributed data in d dimensions:
```
E[h(x)] ≈ log₂(n) for normal points
E[h(x)] ≈ O(1) for anomalies
```

#### Convergence Properties
The algorithm converges with probability 1 as the number of trees T → ∞:
```
lim(T→∞) |Ê(h(x)) - E(h(x))| = 0
```

## 5. Seasonal Decomposition: Time Series Analysis {#seasonal-decomposition}

### Time Series Decomposition Theory

A time series can be decomposed into:
```
Y(t) = T(t) + S(t) + R(t)  (Additive model)
Y(t) = T(t) × S(t) × R(t)  (Multiplicative model)
```

where:
- T(t) = Trend component
- S(t) = Seasonal component
- R(t) = Residual (irregular) component

### STL Decomposition (Seasonal and Trend decomposition using Loess)

#### The Algorithm

1. **Initial Trend Estimation**:
   ```
   T⁽⁰⁾ = MovingAverage(Y, window=seasonal_period)
   ```

2. **Detrending**:
   ```
   Y_detrended = Y - T⁽⁰⁾
   ```

3. **Seasonal Component**:
   ```
   S⁽ᵏ⁾ = Loess(Y_detrended, grouped by season)
   ```

4. **Deseasoning**:
   ```
   Y_deseasoned = Y - S⁽ᵏ⁾
   ```

5. **Trend Update**:
   ```
   T⁽ᵏ⁺¹⁾ = Loess(Y_deseasoned)
   ```

### Fourier Analysis for Seasonality

#### Discrete Fourier Transform (DFT)
```
X(k) = Σₙ₌₀^(N-1) x(n)·e^(-j2πkn/N)
```

#### Power Spectral Density
Identifies dominant frequencies:
```
PSD(f) = |X(f)|²/N
```

### Implementation of Seasonal Anomaly Detection

```typescript
class SeasonalDecomposition {
  decompose(data: number[], period: number): {
    trend: number[],
    seasonal: number[],
    residual: number[]
  } {
    // Step 1: Extract trend using moving average
    const trend = this.movingAverage(data, period);
    
    // Step 2: Detrend the series
    const detrended = data.map((val, i) => val - trend[i]);
    
    // Step 3: Calculate seasonal component
    const seasonal = this.extractSeasonalPattern(detrended, period);
    
    // Step 4: Calculate residuals
    const residual = data.map((val, i) => 
      val - trend[i] - seasonal[i % period]
    );
    
    return { trend, seasonal, residual };
  }
  
  detectAnomalies(residuals: number[], threshold: number): boolean[] {
    const mad = this.medianAbsoluteDeviation(residuals);
    const median = this.median(residuals);
    
    return residuals.map(r => 
      Math.abs(r - median) > threshold * mad
    );
  }
}
```

### Advanced Seasonal Patterns

#### Multiple Seasonalities
For complex patterns (e.g., hourly, daily, weekly):
```
Y(t) = T(t) + S₁(t) + S₂(t) + ... + Sₖ(t) + R(t)
```

#### Dynamic Harmonic Regression
```
Y(t) = β₀ + Σᵢ[αᵢsin(2πfᵢt) + βᵢcos(2πfᵢt)] + ε(t)
```

### Why Seasonal Decomposition Works

1. **Separates Signal from Noise**: Isolates irregular components
2. **Handles Periodic Patterns**: Captures recurring behaviors
3. **Robust to Trends**: Adapts to changing baselines
4. **Interpretable**: Components have clear meanings

## 6. Threshold Detection: Boundary-Based Methods {#threshold-detection}

### Static Threshold Theory

#### Simple Threshold
```
Anomaly if: x > θ_upper OR x < θ_lower
```

#### Percentile-Based Thresholds
Using empirical distribution:
```
θ_lower = Percentile(X, α/2)
θ_upper = Percentile(X, 1 - α/2)
```
where α is the significance level.

### Dynamic Threshold Adaptation

#### Exponential Smoothing
```
θₜ = α·xₜ + (1-α)·θₜ₋₁
```

#### Volatility-Adjusted Thresholds
```
θ_upper(t) = μ(t) + k·σ(t)
θ_lower(t) = μ(t) - k·σ(t)
```
where k adapts based on recent volatility:
```
k(t) = k_base · (1 + γ·CV(t))
CV(t) = σ(t)/μ(t)  (Coefficient of Variation)
```

### Rate of Change Detection

#### First Derivative (Velocity)
```
v(t) = dx/dt ≈ (x(t) - x(t-1))/Δt
```

#### Second Derivative (Acceleration)
```
a(t) = d²x/dt² ≈ (v(t) - v(t-1))/Δt
```

### Implementation of Adaptive Thresholds

```typescript
class AdaptiveThreshold {
  private μ: number = 0;
  private σ: number = 1;
  private readonly α: number = 0.1; // Learning rate
  
  update(value: number): void {
    // Update mean
    this.μ = this.α * value + (1 - this.α) * this.μ;
    
    // Update variance
    const deviation = Math.abs(value - this.μ);
    this.σ = this.α * deviation + (1 - this.α) * this.σ;
  }
  
  getThresholds(multiplier: number): [number, number] {
    const margin = multiplier * this.σ;
    return [this.μ - margin, this.μ + margin];
  }
  
  isAnomaly(value: number, multiplier: number): boolean {
    const [lower, upper] = this.getThresholds(multiplier);
    return value < lower || value > upper;
  }
}
```

### Contextual Thresholds

#### Time-of-Day Patterns
```typescript
class ContextualThreshold {
  private thresholdsByHour: Map<number, ThresholdSet> = new Map();
  
  getContextualThreshold(timestamp: number): ThresholdSet {
    const hour = new Date(timestamp).getHours();
    const dayType = this.isWeekend(timestamp) ? 'weekend' : 'weekday';
    
    return this.thresholdsByHour.get(`${dayType}_${hour}`) || 
           this.getDefaultThreshold();
  }
}
```

### Mathematical Justification

#### Chebyshev's Inequality
For any distribution:
```
P(|X - μ| ≥ kσ) ≤ 1/k²
```

This guarantees:
- k = 2: At most 25% outside bounds
- k = 3: At most 11.1% outside bounds
- k = 4: At most 6.25% outside bounds

## 7. Statistical Ensemble: Multiple Hypothesis Testing {#statistical-ensemble}

### Ensemble Theory

Combining multiple statistical tests increases robustness and reduces false positives.

#### Voting Schemes

1. **Majority Vote**:
   ```
   Anomaly if: Σᵢ I(testᵢ = anomaly) > n/2
   ```

2. **Weighted Vote**:
   ```
   Score = Σᵢ wᵢ · scoreᵢ / Σᵢ wᵢ
   ```

3. **Unanimous Decision**:
   ```
   Anomaly if: ∀i, testᵢ = anomaly
   ```

### Statistical Tests in the Ensemble

#### 1. Grubbs' Test
For detecting outliers in univariate data:
```
G = max|xᵢ - x̄| / s
```
Critical value from t-distribution:
```
G_critical = ((n-1)/√n) · √(t²_α/(2n),n-2 / (n-2+t²_α/(2n),n-2))
```

#### 2. Tukey's Method (IQR)
```
Q1 = 25th percentile
Q3 = 75th percentile
IQR = Q3 - Q1
Lower fence = Q1 - k·IQR
Upper fence = Q3 + k·IQR
```
Typically k = 1.5 for outliers, k = 3 for extreme outliers.

#### 3. Generalized ESD Test
For multiple outliers:
```
R₁ = max|xᵢ - x̄| / s
Remove x₁, recalculate R₂, ..., Rᵣ
Compare each Rᵢ with critical value λᵢ
```

### Implementation of Statistical Ensemble

```typescript
class StatisticalEnsemble {
  private tests: StatisticalTest[] = [
    new GrubbsTest(),
    new IranTest(),
    new ModifiedZScoreTest(),
    new ESDTest()
  ];
  
  detectAnomaly(data: number[], point: number): {
    isAnomaly: boolean,
    confidence: number,
    details: TestResult[]
  } {
    const results = this.tests.map(test => test.test(data, point));
    
    // Weighted ensemble
    const weights = this.calculateTestWeights(results);
    const weightedScore = results.reduce((sum, result, i) => 
      sum + weights[i] * result.score, 0
    );
    
    return {
      isAnomaly: weightedScore > this.threshold,
      confidence: this.calculateConfidence(results, weights),
      details: results
    };
  }
  
  private calculateTestWeights(results: TestResult[]): number[] {
    // Dynamic weight adjustment based on recent performance
    return results.map(result => {
      const accuracy = result.historicalAccuracy || 0.5;
      const consistency = result.consistencyScore || 0.5;
      return accuracy * consistency;
    });
  }
}
```

### Multiple Testing Correction

When performing multiple statistical tests, we need to control the family-wise error rate (FWER).

#### Bonferroni Correction
Adjust significance level:
```
α_adjusted = α / m
```
where m is the number of tests.

#### False Discovery Rate (FDR) Control
Benjamini-Hochberg procedure:
1. Order p-values: p₁ ≤ p₂ ≤ ... ≤ pₘ
2. Find largest i such that pᵢ ≤ (i/m)·α
3. Reject H₀ for all tests 1, ..., i

## 8. Machine Learning Approaches {#machine-learning-approaches}

### Autoencoder-Based Detection

#### Architecture
An autoencoder learns to compress and reconstruct normal data:

```
Input → Encoder → Latent Space → Decoder → Reconstruction
   x        f(x)        z         g(z)         x̂
```

#### Loss Function
Reconstruction error indicates anomaly:
```
L(x, x̂) = ||x - x̂||² = Σᵢ(xᵢ - x̂ᵢ)²
```

#### Anomaly Score
```
score(x) = L(x, x̂) / median(L(X_train, X̂_train))
```

### Implementation of Autoencoder

```typescript
class Autoencoder {
  private encoder: NeuralNetwork;
  private decoder: NeuralNetwork;
  private threshold: number;
  
  constructor(inputDim: number, latentDim: number) {
    // Encoder: input_dim → hidden → latent_dim
    this.encoder = new NeuralNetwork([
      { size: inputDim, activation: 'input' },
      { size: Math.floor(inputDim * 0.75), activation: 'relu' },
      { size: Math.floor(inputDim * 0.5), activation: 'relu' },
      { size: latentDim, activation: 'linear' }
    ]);
    
    // Decoder: latent_dim → hidden → input_dim
    this.decoder = new NeuralNetwork([
      { size: latentDim, activation: 'input' },
      { size: Math.floor(inputDim * 0.5), activation: 'relu' },
      { size: Math.floor(inputDim * 0.75), activation: 'relu' },
      { size: inputDim, activation: 'linear' }
    ]);
  }
  
  train(normalData: number[][]): void {
    const epochs = 100;
    const batchSize = 32;
    const learningRate = 0.001;
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      const batches = this.createBatches(normalData, batchSize);
      
      for (const batch of batches) {
        // Forward pass
        const encoded = batch.map(x => this.encoder.forward(x));
        const decoded = encoded.map(z => this.decoder.forward(z));
        
        // Calculate gradients
        const losses = batch.map((x, i) => 
          this.mse(x, decoded[i])
        );
        
        // Backward pass
        this.updateWeights(losses, learningRate);
      }
    }
    
    // Set threshold based on training data
    this.threshold = this.calculateThreshold(normalData);
  }
  
  detectAnomaly(x: number[]): boolean {
    const z = this.encoder.forward(x);
    const x_reconstructed = this.decoder.forward(z);
    const error = this.mse(x, x_reconstructed);
    
    return error > this.threshold;
  }
}
```

### LSTM for Temporal Anomalies

#### LSTM Cell Equations
```
fₜ = σ(Wf·[hₜ₋₁, xₜ] + bf)    // Forget gate
iₜ = σ(Wi·[hₜ₋₁, xₜ] + bi)    // Input gate
C̃ₜ = tanh(WC·[hₜ₋₁, xₜ] + bC) // Candidate values
Cₜ = fₜ * Cₜ₋₁ + iₜ * C̃ₜ      // Cell state
oₜ = σ(Wo·[hₜ₋₁, xₜ] + bo)    // Output gate
hₜ = oₜ * tanh(Cₜ)            // Hidden state
```

#### Sequence Prediction
```typescript
class LSTMAnomaly {
  predictNext(sequence: number[][]): number[] {
    let hidden = this.initialHidden;
    let cell = this.initialCell;
    
    for (const x of sequence) {
      [hidden, cell] = this.lstmCell(x, hidden, cell);
    }
    
    return this.outputLayer(hidden);
  }
  
  getAnomalyScore(sequence: number[][], actual: number[]): number {
    const predicted = this.predictNext(sequence);
    return this.distance(predicted, actual);
  }
}
```

### One-Class SVM

#### Optimization Problem
Find hyperplane that separates normal data from origin with maximum margin:

```
min(w,ξ,ρ) ½||w||² + 1/(νn)Σᵢξᵢ - ρ

subject to:
(w·φ(xᵢ)) ≥ ρ - ξᵢ
ξᵢ ≥ 0
```

where:
- ν ∈ (0, 1]: upper bound on fraction of outliers
- ξᵢ: slack variables
- φ: kernel mapping

#### Decision Function
```
f(x) = sign((w·φ(x)) - ρ)
```
Anomaly if f(x) < 0.

### Gaussian Mixture Model (GMM)

#### Probability Density
```
p(x) = Σₖ₌₁^K πₖ·𝒩(x|μₖ, Σₖ)
```
where:
- πₖ: mixing coefficients (Σπₖ = 1)
- 𝒩(x|μₖ, Σₖ): Gaussian component

#### EM Algorithm
1. **E-step**: Calculate responsibilities
   ```
   γₙₖ = πₖ·𝒩(xₙ|μₖ, Σₖ) / Σⱼπⱼ·𝒩(xₙ|μⱼ, Σⱼ)
   ```

2. **M-step**: Update parameters
   ```
   πₖ = Nₖ/N
   μₖ = Σₙγₙₖxₙ / Nₖ
   Σₖ = Σₙγₙₖ(xₙ-μₖ)(xₙ-μₖ)ᵀ / Nₖ
   ```

## 9. Composite Detection: Ensemble Methods {#composite-detection}

### Theoretical Foundation

The power of ensemble methods comes from the bias-variance tradeoff and diversity among detectors.

#### Bias-Variance Decomposition
For squared error:
```
E[(y - f̂(x))²] = Bias²[f̂(x)] + Var[f̂(x)] + σ²
```

Ensembles reduce variance while maintaining low bias.

### Ensemble Strategies

#### 1. Simple Averaging
```
Score_ensemble = (1/M) Σᵢ₌₁^M scoreᵢ
```

#### 2. Weighted Averaging
```
Score_ensemble = Σᵢ₌₁^M wᵢ·scoreᵢ / Σᵢ₌₁^M wᵢ
```

#### 3. Stacking (Meta-Learning)
Train a meta-model on detector outputs:
```
f_meta(x) = g(f₁(x), f₂(x), ..., fₘ(x))
```

### Dynamic Weight Calculation

```typescript
class AdaptiveEnsemble {
  private performanceHistory: Map<string, PerformanceMetrics> = new Map();
  
  calculateDynamicWeights(
    detectors: string[],
    context: DetectionContext
  ): number[] {
    return detectors.map(detector => {
      const perf = this.performanceHistory.get(detector);
      
      // Base weight from historical accuracy
      let weight = perf?.accuracy || 0.5;
      
      // Adjust for recency
      const recencyFactor = this.calculateRecencyFactor(perf);
      weight *= recencyFactor;
      
      // Adjust for context similarity
      const contextFactor = this.calculateContextSimilarity(
        perf?.bestContexts || [],
        context
      );
      weight *= contextFactor;
      
      // Adjust for computational cost
      const costFactor = 1 / (1 + perf?.avgLatency || 1);
      weight *= costFactor;
      
      return weight;
    });
  }
  
  private calculateRecencyFactor(perf: PerformanceMetrics): number {
    if (!perf) return 1;
    
    const hoursSinceLastUpdate = 
      (Date.now() - perf.lastUpdate) / (1000 * 60 * 60);
    
    // Exponential decay with half-life of 24 hours
    return Math.exp(-0.693 * hoursSinceLastUpdate / 24);
  }
}
```

### Hierarchical Detection

```typescript
class HierarchicalDetector {
  private layers: DetectorLayer[] = [
    // Layer 1: Fast, simple detectors
    {
      detectors: ['threshold', 'zscore'],
      threshold: 0.3,
      passThrough: 0.7
    },
    // Layer 2: Medium complexity
    {
      detectors: ['isolation_forest', 'seasonal'],
      threshold: 0.5,
      passThrough: 0.8
    },
    // Layer 3: Complex, accurate detectors
    {
      detectors: ['machine_learning', 'statistical_ensemble'],
      threshold: 0.7,
      passThrough: 1.0
    }
  ];
  
  detect(data: IAnomalyData[]): IAnomaly[] {
    let candidates = data;
    let anomalies: IAnomaly[] = [];
    
    for (const layer of this.layers) {
      const results = this.runLayer(candidates, layer);
      
      // Definite anomalies
      anomalies.push(...results.filter(r => r.score > layer.passThrough));
      
      // Candidates for next layer
      candidates = results
        .filter(r => r.score > layer.threshold && r.score <= layer.passThrough)
        .map(r => r.data);
      
      // Early stopping if no candidates
      if (candidates.length === 0) break;
    }
    
    return anomalies;
  }
}
```

### Mathematical Properties of Ensembles

#### Diversity Measure
Diversity among detectors using Q-statistic:
```
Q_ij = (N¹¹N⁰⁰ - N¹⁰N⁰¹) / (N¹¹N⁰⁰ + N¹⁰N⁰¹)
```
where N^ab is the number of samples where detector i predicts a and detector j predicts b.

#### Ensemble Error Bound
For majority voting with M independent detectors each with error rate p < 0.5:
```
P(ensemble error) ≤ Σₖ₌⌈M/2⌉^M (M choose k) p^k(1-p)^(M-k)
```

## 10. Performance Metrics and Evaluation {#performance-metrics}

### Classification Metrics

#### Confusion Matrix
```
                 Predicted
              Anomaly  Normal
Actual Anomaly   TP      FN
       Normal    FP      TN
```

#### Key Metrics
1. **Precision**: TP / (TP + FP)
2. **Recall (Sensitivity)**: TP / (TP + FN)
3. **Specificity**: TN / (TN + FP)
4. **F1-Score**: 2 × (Precision × Recall) / (Precision + Recall)
5. **F-β Score**: (1 + β²) × (Precision × Recall) / (β² × Precision + Recall)

### ROC and AUC Analysis

#### ROC Curve
Plot of True Positive Rate vs False Positive Rate:
```
TPR = TP / (TP + FN)
FPR = FP / (FP + TN)
```

#### Area Under Curve (AUC)
```
AUC = ∫₀¹ TPR(FPR) d(FPR)
```

Interpretation:
- AUC = 0.5: Random classifier
- AUC = 1.0: Perfect classifier
- AUC > 0.9: Excellent
- AUC > 0.8: Good

### Precision-Recall Curve

More informative for imbalanced datasets:
```
Average Precision = Σₙ(Rₙ - Rₙ₋₁)Pₙ
```

### Time-Aware Metrics

#### Detection Latency
```
Latency = t_detection - t_occurrence
```

#### Time to Detection (TTD)
Average time to detect after anomaly occurrence.

#### Mean Time Between False Alarms (MTBFA)
```
MTBFA = Total_Time / Number_of_False_Alarms
```

### Implementation of Performance Tracker

```typescript
class PerformanceTracker {
  private predictions: Prediction[] = [];
  private groundTruth: GroundTruth[] = [];
  
  calculateMetrics(): PerformanceMetrics {
    const cm = this.buildConfusionMatrix();
    
    return {
      accuracy: (cm.tp + cm.tn) / cm.total,
      precision: cm.tp / (cm.tp + cm.fp),
      recall: cm.tp / (cm.tp + cm.fn),
      specificity: cm.tn / (cm.tn + cm.fp),
      f1Score: this.calculateF1(cm),
      mcc: this.calculateMCC(cm),
      auc: this.calculateAUC(),
      avgLatency: this.calculateAvgLatency(),
      mtbfa: this.calculateMTBFA()
    };
  }
  
  private calculateMCC(cm: ConfusionMatrix): number {
    // Matthews Correlation Coefficient
    const numerator = cm.tp * cm.tn - cm.fp * cm.fn;
    const denominator = Math.sqrt(
      (cm.tp + cm.fp) * (cm.tp + cm.fn) * 
      (cm.tn + cm.fp) * (cm.tn + cm.fn)
    );
    
    return denominator === 0 ? 0 : numerator / denominator;
  }
}
```

## 11. Real-World Applications {#real-world-applications}

### System Performance Monitoring

#### CPU Usage Anomalies
- **Normal Pattern**: Diurnal cycle with business hours peaks
- **Anomalies**: Sudden spikes, gradual degradation, unusual patterns
- **Detection**: Seasonal decomposition + threshold detection

#### Memory Leak Detection
- **Pattern**: Monotonically increasing memory usage
- **Detection**: Trend analysis + rate of change monitoring

### Network Security

#### DDoS Attack Detection
- **Pattern**: Sudden increase in request rate
- **Features**: Request rate, unique IPs, packet size distribution
- **Detection**: Statistical ensemble + machine learning

#### Intrusion Detection
- **Pattern**: Unusual access patterns, privilege escalation
- **Features**: Access frequency, time of access, resource accessed
- **Detection**: Isolation Forest + behavioral analysis

### Financial Fraud Detection

#### Credit Card Fraud
- **Features**: Transaction amount, location, time, merchant category
- **Patterns**: Unusual spending patterns, geographical impossibilities
- **Detection**: ML models + rule-based systems

### IoT and Sensor Networks

#### Sensor Malfunction
- **Pattern**: Constant values, out-of-range readings, missing data
- **Detection**: Statistical tests + hardware-specific rules

#### Environmental Monitoring
- **Pattern**: Gradual changes, seasonal variations
- **Detection**: Time series analysis + threshold monitoring

## 12. Implementation Best Practices {#best-practices}

### Data Preprocessing

#### 1. Missing Value Handling
```typescript
class DataPreprocessor {
  handleMissing(data: (number | null)[]): number[] {
    // Option 1: Interpolation
    return this.linearInterpolation(data);
    
    // Option 2: Forward fill
    return this.forwardFill(data);
    
    // Option 3: Statistical imputation
    return this.meanImputation(data);
  }
  
  private linearInterpolation(data: (number | null)[]): number[] {
    const result = [...data];
    
    for (let i = 0; i < result.length; i++) {
      if (result[i] === null) {
        const [prev, next] = this.findNearest(data, i);
        if (prev !== -1 && next !== -1) {
          result[i] = data[prev]! + 
            (data[next]! - data[prev]!) * (i - prev) / (next - prev);
        }
      }
    }
    
    return result as number[];
  }
}
```

#### 2. Outlier-Robust Normalization
```typescript
class RobustScaler {
  private median: number;
  private mad: number;
  
  fit(data: number[]): void {
    this.median = this.calculateMedian(data);
    const deviations = data.map(x => Math.abs(x - this.median));
    this.mad = this.calculateMedian(deviations);
  }
  
  transform(value: number): number {
    return (value - this.median) / (1.4826 * this.mad);
  }
}
```

### Feature Engineering

#### Time-Based Features
```typescript
function extractTimeFeatures(timestamp: number): TimeFeatures {
  const date = new Date(timestamp);
  
  return {
    hourOfDay: date.getHours(),
    dayOfWeek: date.getDay(),
    dayOfMonth: date.getDate(),
    weekOfYear: Math.ceil((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)),
    isWeekend: date.getDay() === 0 || date.getDay() === 6,
    isBusinessHour: date.getHours() >= 9 && date.getHours() < 17,
    sinHour: Math.sin(2 * Math.PI * date.getHours() / 24),
    cosHour: Math.cos(2 * Math.PI * date.getHours() / 24),
    sinDay: Math.sin(2 * Math.PI * date.getDay() / 7),
    cosDay: Math.cos(2 * Math.PI * date.getDay() / 7)
  };
}
```

#### Rolling Statistics
```typescript
class RollingFeatures {
  extract(data: number[], windows: number[]): Features {
    const features: Features = {};
    
    for (const window of windows) {
      const rolling = this.rollingWindow(data, window);
      
      features[`mean_${window}`] = rolling.map(w => this.mean(w));
      features[`std_${window}`] = rolling.map(w => this.std(w));
      features[`min_${window}`] = rolling.map(w => Math.min(...w));
      features[`max_${window}`] = rolling.map(w => Math.max(...w));
      features[`range_${window}`] = rolling.map(w => 
        Math.max(...w) - Math.min(...w)
      );
      features[`skew_${window}`] = rolling.map(w => this.skewness(w));
      features[`kurt_${window}`] = rolling.map(w => this.kurtosis(w));
    }
    
    return features;
  }
}
```

### Parameter Tuning

#### Grid Search
```typescript
class GridSearchOptimizer {
  optimize(
    paramGrid: ParameterGrid,
    evaluator: (params: Parameters) => number
  ): OptimalParameters {
    let bestScore = -Infinity;
    let bestParams: Parameters = {};
    
    for (const params of this.generateCombinations(paramGrid)) {
      const score = evaluator(params);
      
      if (score > bestScore) {
        bestScore = score;
        bestParams = params;
      }
    }
    
    return { params: bestParams, score: bestScore };
  }
}
```

#### Bayesian Optimization
```typescript
class BayesianOptimizer {
  optimize(
    paramSpace: ParameterSpace,
    objective: ObjectiveFunction,
    nIterations: number
  ): OptimalParameters {
    const gp = new GaussianProcess();
    const observations: Observation[] = [];
    
    // Initial random sampling
    for (let i = 0; i < 5; i++) {
      const params = this.sampleRandom(paramSpace);
      const score = objective(params);
      observations.push({ params, score });
    }
    
    // Bayesian optimization loop
    for (let i = 0; i < nIterations; i++) {
      gp.fit(observations);
      
      // Acquisition function (Expected Improvement)
      const nextParams = this.maximizeEI(gp, paramSpace);
      const score = objective(nextParams);
      
      observations.push({ params: nextParams, score });
    }
    
    return this.getBest(observations);
  }
}
```

### Production Considerations

#### 1. Streaming Implementation
```typescript
class StreamingAnomalyDetector {
  private buffer: CircularBuffer;
  private detector: OnlineDetector;
  
  processStream(stream: DataStream): void {
    stream.on('data', (data: DataPoint) => {
      // Update statistics
      this.detector.updateStatistics(data);
      
      // Add to buffer
      this.buffer.add(data);
      
      // Detect anomaly
      if (this.buffer.isFull()) {
        const score = this.detector.score(data, this.buffer.getWindow());
        
        if (score > this.threshold) {
          this.emitAnomaly({
            data,
            score,
            timestamp: Date.now()
          });
        }
      }
    });
  }
}
```

#### 2. Scalability Patterns
```typescript
class DistributedDetector {
  private workers: Worker[] = [];
  private coordinator: Coordinator;
  
  async detectBatch(data: DataBatch): Promise<Anomaly[]> {
    // Partition data
    const partitions = this.partitionData(data, this.workers.length);
    
    // Parallel detection
    const promises = partitions.map((partition, i) => 
      this.workers[i].detect(partition)
    );
    
    // Aggregate results
    const results = await Promise.all(promises);
    return this.coordinator.aggregate(results);
  }
}
```

#### 3. Model Persistence
```typescript
class ModelPersistence {
  save(detector: AnomalyDetector, path: string): void {
    const state = {
      type: detector.constructor.name,
      version: detector.version,
      parameters: detector.getParameters(),
      statistics: detector.getStatistics(),
      timestamp: Date.now()
    };
    
    fs.writeFileSync(path, JSON.stringify(state));
  }
  
  load(path: string): AnomalyDetector {
    const state = JSON.parse(fs.readFileSync(path, 'utf-8'));
    const detector = this.createDetector(state.type);
    
    detector.setParameters(state.parameters);
    detector.setStatistics(state.statistics);
    
    return detector;
  }
}
```

## Conclusion

Anomaly detection is a rich field combining statistics, machine learning, and domain knowledge. The key to successful implementation is:

1. **Understanding the Data**: Know your normal patterns and types of anomalies
2. **Choosing the Right Method**: Match the algorithm to your use case
3. **Proper Evaluation**: Use appropriate metrics for your domain
4. **Continuous Improvement**: Monitor and adapt to changing patterns

The mathematical foundations provide the theoretical guarantees, while practical implementations must balance accuracy, performance, and interpretability.

Remember: No single method works for all cases. The art lies in combining multiple approaches and adapting them to your specific needs.
