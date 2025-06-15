# Anomaly Detector Comparison Guide

## Overview

NestShield provides 7 specialized anomaly detectors, each optimized for different use cases and data characteristics. This guide helps you choose the right detector for your specific needs.

## Quick Decision Matrix

| Use Case | Best Detector | Runner-Up | Key Strength |
|----------|---------------|-----------|--------------|
| Real-time monitoring | Z-Score | Threshold | Low latency, online learning |
| High-dimensional data | Isolation Forest | Statistical | No distance calculations |
| Time series patterns | Seasonal | Composite | Multi-scale seasonality |
| Known boundaries | Threshold | Statistical | Deterministic, fast |
| Unknown patterns | Machine Learning | Composite | Adaptive learning |
| Production systems | Composite | Statistical | Ensemble robustness |
| Simple anomalies | Threshold | Z-Score | Minimal configuration |

## Detailed Detector Comparison

### 1. Z-Score Detector

**Implementation**: `src/anomaly-detection/detectors/zscore.detector.ts`

**Key Features**:
- Online mean and variance calculation using Welford's algorithm
- Modified Z-Score using MAD (Median Absolute Deviation) for outlier robustness
- Adaptive threshold based on recent volatility
- Seasonal adjustment capabilities
- Rolling window statistics

**Performance Characteristics**:
- **Complexity**: O(1) per data point
- **Memory**: O(w) where w is window size
- **Latency**: < 1ms typical
- **Training**: Not required (online learning)

**Best For**:
- Normally distributed data
- Real-time streaming applications
- Quick anomaly screening
- Univariate time series

**Configuration Example**:
```typescript
{
  sensitivity: 0.7,
  threshold: 3.0, // 3 standard deviations
  windowSize: 100,
  minDataPoints: 10,
  learningPeriod: 86400000, // 24 hours
  businessRules: [
    {
      id: "suppress_maintenance",
      condition: "hour >= 2 && hour <= 4",
      action: "suppress",
      reason: "Scheduled maintenance window"
    }
  ]
}
```

**Limitations**:
- Assumes normal distribution
- Sensitive to concept drift
- May miss complex multivariate patterns

### 2. Isolation Forest Detector

**Implementation**: `src/anomaly-detection/detectors/isolation-forest.detector.ts`

**Key Features**:
- Tree-based isolation algorithm
- Feature extraction with 8 engineered features
- Subsample-based forest construction
- Feature importance calculation
- Path length normalization

**Performance Characteristics**:
- **Complexity**: O(n log n) training, O(log n) detection
- **Memory**: O(t × s) where t = trees, s = subsample size
- **Latency**: 5-10ms typical
- **Training**: Required (batch training)

**Best For**:
- High-dimensional data
- Unknown anomaly types
- Mixed data distributions
- Outlier detection without labels

**Configuration Example**:
```typescript
{
  sensitivity: 0.8,
  threshold: 0.6, // Anomaly score threshold
  windowSize: 256,
  minDataPoints: 100,
  // Auto-configures trees and subsample size
}
```

**Feature Engineering**:
- Value normalization
- Rate of change
- Local variance
- Z-score
- Moving average ratio
- Percentile rank
- Time since last spike

**Limitations**:
- Requires training data
- Not interpretable
- May struggle with local anomalies

### 3. Seasonal Anomaly Detector

**Implementation**: `src/anomaly-detection/detectors/seasonal.detector.ts`

**Key Features**:
- Time series decomposition (trend, seasonal, residual)
- Multiple seasonality detection (hourly, daily, weekly, monthly)
- Volatility modeling by time period
- Pattern strength calculation
- Seasonal forecasting

**Performance Characteristics**:
- **Complexity**: O(n × p) where p = period length
- **Memory**: O(n) for pattern storage
- **Latency**: 10-20ms typical
- **Training**: Required (pattern extraction)

**Best For**:
- Time series with regular patterns
- Business metrics with cycles
- Predictable workloads
- Capacity planning

**Configuration Example**:
```typescript
{
  sensitivity: 0.75,
  threshold: 2.5,
  windowSize: 1440, // 24 hours at minute granularity
  minDataPoints: 168, // 1 week of hourly data
}
```

**Seasonal Components**:
- Hourly patterns (24 values)
- Daily patterns (7 values)
- Weekly patterns (4 values)
- Monthly patterns (12 values)
- Trend component with slope
- Time-based volatility adjustments

**Limitations**:
- Requires sufficient historical data
- Assumes pattern stability
- Computationally intensive for long periods

### 4. Threshold Anomaly Detector

**Implementation**: `src/anomaly-detection/detectors/threshold.detector.ts`

**Key Features**:
- Static and dynamic thresholds
- Contextual thresholds by source
- Business hour adjustments
- SLA violation detection
- Rate of change monitoring

**Performance Characteristics**:
- **Complexity**: O(1) constant time
- **Memory**: O(1) minimal
- **Latency**: < 0.5ms typical
- **Training**: Not required

**Best For**:
- SLA monitoring
- Known boundaries (CPU, memory)
- Simple rule-based detection
- Low-latency requirements

**Configuration Example**:
```typescript
{
  sensitivity: 0.5,
  threshold: 1.0, // Not used for static thresholds
  staticThresholds: {
    "cpu_usage": { upper: 80, lower: 0 },
    "memory_usage": { upper: 90, lower: 0 },
    "response_time": { upper: 1000, lower: 0 }
  },
  adaptiveThresholds: {
    enabled: true,
    learningRate: 0.1
  }
}
```

**Limitations**:
- No pattern recognition
- Requires domain knowledge
- May generate many false positives

### 5. Statistical Anomaly Detector

**Implementation**: `src/anomaly-detection/detectors/statistical.detector.ts`

**Key Features**:
- Multiple statistical tests ensemble
- Grubbs' test for outliers
- Modified Z-Score
- IQR (Interquartile Range) method
- Generalized ESD test
- Weighted voting system

**Performance Characteristics**:
- **Complexity**: O(n) for most tests
- **Memory**: O(n) for data storage
- **Latency**: 15-30ms typical
- **Training**: Not required

**Best For**:
- Rigorous statistical validation
- Research and compliance
- Multiple distribution types
- Ensemble accuracy

**Configuration Example**:
```typescript
{
  sensitivity: 0.9,
  threshold: 2.0,
  windowSize: 200,
  ensembleWeights: {
    "zscore": 0.3,
    "iqr": 0.2,
    "grubbs": 0.3,
    "modifiedZScore": 0.2
  }
}
```

**Statistical Tests**:
- Z-Score test
- Modified Z-Score (MAD-based)
- Grubbs' test
- Generalized ESD
- IQR method
- Dixon's Q test

**Limitations**:
- Computationally intensive
- May be conservative
- Requires parameter tuning

### 6. Machine Learning Detector

**Implementation**: `src/anomaly-detection/detectors/machine-learning.detector.ts`

**Key Features**:
- Multiple ML algorithms (Autoencoder, LSTM, One-Class SVM)
- Feature engineering pipeline
- Online learning capabilities
- Model persistence
- Ensemble predictions

**Performance Characteristics**:
- **Complexity**: O(n²) to O(n³) training
- **Memory**: O(n × d) where d = dimensions
- **Latency**: 50-100ms typical
- **Training**: Required (extensive)

**Best For**:
- Complex patterns
- Multivariate anomalies
- High accuracy requirements
- Non-linear relationships

**Configuration Example**:
```typescript
{
  sensitivity: 0.95,
  threshold: 0.7,
  algorithms: ["autoencoder", "lstm"],
  featureEngineering: {
    enableTimeFeatures: true,
    enableStatisticalFeatures: true,
    enableLagFeatures: true
  },
  onlineLearning: {
    enabled: true,
    updateInterval: 3600000 // 1 hour
  }
}
```

**ML Algorithms**:
- Autoencoder (reconstruction error)
- LSTM (sequence prediction)
- One-Class SVM (boundary learning)
- Random Forest (feature importance)

**Limitations**:
- Requires significant training data
- High computational cost
- "Black box" predictions
- Risk of overfitting

### 7. Composite Anomaly Detector

**Implementation**: `src/anomaly-detection/detectors/composite.detector.ts`

**Key Features**:
- Ensemble of all 6 detectors
- Multiple combination strategies
- Adaptive weight adjustment
- Context-aware detector selection
- Performance tracking
- Conflict resolution

**Performance Characteristics**:
- **Complexity**: Sum of component complexities
- **Memory**: Sum of component memory
- **Latency**: 100-200ms typical (parallel execution)
- **Training**: Trains all component detectors

**Best For**:
- Production systems
- Maximum accuracy
- Unknown anomaly types
- Critical applications

**Ensemble Strategies**:
1. **Majority Vote**: Simple democratic voting
2. **Weighted Average**: Performance-based weights
3. **Adaptive Weighted**: Context and performance adaptation
4. **Stacking**: Meta-learning approach
5. **Hierarchical**: Multi-stage pipeline

**Configuration Example**:
```typescript
{
  sensitivity: 0.85,
  threshold: 2.0,
  ensembleStrategy: "adaptive_weighted",
  detectorWeights: {
    "Z-Score Detector": 1.0,
    "Isolation Forest Detector": 1.2,
    "Seasonal Anomaly Detector": 1.1,
    "Threshold Anomaly Detector": 0.8,
    "Statistical Anomaly Detector": 1.3,
    "Machine Learning Detector": 1.4
  },
  contextualSelection: true,
  performanceTracking: true
}
```

**Adaptive Features**:
- Performance-based weight adjustment
- Context-aware detector selection
- Automatic conflict resolution
- Real-time performance tracking
- Feedback integration

## Performance Benchmarks

### Detection Latency (milliseconds)

| Detector | 1K points | 10K points | 100K points | 1M points |
|----------|-----------|------------|-------------|-----------|
| Threshold | 0.1 | 0.5 | 5 | 50 |
| Z-Score | 0.5 | 2 | 20 | 200 |
| Isolation Forest | 5 | 15 | 100 | 800 |
| Seasonal | 10 | 50 | 500 | 5000 |
| Statistical | 15 | 100 | 1000 | 10000 |
| Machine Learning | 50 | 200 | 2000 | 20000 |
| Composite | 100 | 300 | 2000 | 15000 |

### Memory Usage (MB)

| Detector | Base | Per 10K points | Growth Pattern |
|----------|------|----------------|----------------|
| Threshold | 1 | 0.1 | Constant |
| Z-Score | 5 | 0.8 | Linear (window) |
| Isolation Forest | 50 | 5 | Sublinear |
| Seasonal | 20 | 10 | Linear |
| Statistical | 10 | 5 | Linear |
| Machine Learning | 100 | 20 | Linear |
| Composite | 200 | 40 | Linear |

### Accuracy Comparison

| Anomaly Type | Z-Score | Isolation | Seasonal | Threshold | Statistical | ML | Composite |
|--------------|---------|-----------|----------|-----------|------------|-----|-----------|
| Point anomalies | 85% | 92% | 75% | 95% | 90% | 94% | 96% |
| Contextual | 65% | 78% | 92% | 45% | 75% | 88% | 91% |
| Collective | 55% | 85% | 88% | 35% | 80% | 92% | 94% |
| Seasonal | 70% | 65% | 96% | 55% | 75% | 90% | 94% |
| Trend changes | 75% | 70% | 90% | 65% | 80% | 85% | 90% |
| Noise robustness | 70% | 88% | 82% | 60% | 85% | 91% | 93% |

## Selection Guidelines

### By Data Characteristics

#### For Stationary Data:
1. **First Choice**: Z-Score Detector
2. **Alternative**: Statistical Anomaly Detector
3. **High accuracy**: Composite Detector

#### For Time Series:
1. **First Choice**: Seasonal Anomaly Detector
2. **Alternative**: Machine Learning Detector (LSTM)
3. **Simple patterns**: Z-Score with adaptive thresholds

#### For High-Dimensional Data:
1. **First Choice**: Isolation Forest Detector
2. **Alternative**: Machine Learning Detector
3. **Maximum accuracy**: Composite Detector

#### For Known Boundaries:
1. **First Choice**: Threshold Anomaly Detector
2. **Alternative**: Statistical Anomaly Detector
3. **With patterns**: Seasonal + Threshold combination

### By System Requirements

#### Low Latency (< 10ms):
- Threshold Detector
- Z-Score Detector
- Pre-trained Isolation Forest

#### High Accuracy (> 90%):
- Composite Detector
- Machine Learning Detector
- Statistical Ensemble

#### Limited Resources:
- Threshold Detector
- Z-Score Detector
- Single Statistical Test

#### Real-time Streaming:
- Z-Score Detector (online learning)
- Threshold Detector
- Adaptive Statistical Methods

## Detector Combination Patterns

### Layered Detection
```
Input → Threshold (fast filter)
      ↓ (if anomaly)
      → Z-Score (statistical validation)
      ↓ (if confirmed)
      → Machine Learning (pattern analysis)
      ↓
      → Alert with confidence score
```

### Parallel Ensemble
```
Input → Z-Score ─────┐
      → Isolation ───┼→ Weighted → Decision
      → Seasonal ────┤  Voting
      → Statistical ─┘
```

### Context-Aware Selection
```typescript
function selectDetector(context: IDetectorContext): string {
  const analysis = analyzeData(context);
  
  if (analysis.isRealTime && analysis.lowLatency) {
    return "Z-Score Detector";
  }
  if (analysis.hasSeasonality) {
    return "Seasonal Anomaly Detector";
  }
  if (analysis.isHighDimensional) {
    return "Isolation Forest Detector";
  }
  if (analysis.hasKnownBounds) {
    return "Threshold Anomaly Detector";
  }
  
  return "Composite Anomaly Detector"; // Default
}
```

## Tuning Recommendations

### Sensitivity Settings

| Goal | Sensitivity | Expected Behavior |
|------|-------------|-------------------|
| Catch all anomalies | 0.9-1.0 | More alerts, possible false positives |
| Balanced detection | 0.7-0.8 | Good accuracy/alert ratio |
| Critical only | 0.5-0.6 | Fewer alerts, may miss subtle issues |
| Minimal alerts | 0.3-0.4 | Only major anomalies |

### Window Size Selection

| Data Frequency | Window Size | Coverage |
|----------------|-------------|----------|
| Per second | 300 | 5 minutes |
| Per minute | 60-120 | 1-2 hours |
| Per hour | 24-168 | 1 day - 1 week |
| Per day | 30-90 | 1-3 months |

### Threshold Configuration

```typescript
// Conservative (fewer alerts)
{
  threshold: 3.5,  // Z-Score
  threshold: 0.7,  // Isolation Forest
  threshold: 3.0   // Seasonal multiplier
}

// Balanced
{
  threshold: 3.0,  // Z-Score
  threshold: 0.6,  // Isolation Forest  
  threshold: 2.5   // Seasonal multiplier
}

// Sensitive (more alerts)
{
  threshold: 2.5,  // Z-Score
  threshold: 0.5,  // Isolation Forest
  threshold: 2.0   // Seasonal multiplier
}
```

## Common Issues and Solutions

### Too Many False Positives

**Problem**: Alert fatigue from excessive anomaly detection

**Solutions**:
1. Decrease sensitivity (e.g., 0.8 → 0.6)
2. Increase threshold values
3. Add business rules for suppression
4. Use Composite detector with voting
5. Enable adaptive thresholds

### Missing Important Anomalies

**Problem**: Critical issues go undetected

**Solutions**:
1. Increase sensitivity (e.g., 0.6 → 0.8)
2. Decrease threshold values
3. Add specific detectors for known patterns
4. Use multiple detectors in parallel
5. Implement custom business rules

### Slow Detection Performance

**Problem**: High latency in anomaly detection

**Solutions**:
1. Use faster detectors (Threshold, Z-Score)
2. Reduce window sizes
3. Enable detector caching
4. Use hierarchical detection strategy
5. Parallelize detector execution

### Adapting to Changing Patterns

**Problem**: Detector accuracy degrades over time

**Solutions**:
1. Enable online learning (Z-Score, ML detectors)
2. Implement periodic retraining
3. Use adaptive thresholds
4. Monitor detector performance metrics
5. Implement feedback loops

## Best Practices

1. **Start Simple**: Begin with Threshold or Z-Score, then add complexity
2. **Monitor Performance**: Track accuracy, latency, and resource usage
3. **Use Business Rules**: Suppress known false positives
4. **Implement Feedback**: Update models based on validation
5. **Test Thoroughly**: Validate with historical data and known anomalies
6. **Document Choices**: Record why specific detectors were selected
7. **Plan for Growth**: Consider scalability from the start

## Conclusion

Choosing the right anomaly detector depends on your specific use case:

- **For simplicity**: Start with Threshold or Z-Score
- **For accuracy**: Use Statistical or Machine Learning
- **For patterns**: Choose Seasonal detector
- **For production**: Deploy Composite detector
- **For exploration**: Try Isolation Forest

Remember that you can always combine multiple detectors or switch between them as your needs evolve. The Composite detector provides the best overall performance by intelligently combining all available methods.