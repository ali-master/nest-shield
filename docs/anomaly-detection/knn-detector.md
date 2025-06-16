# K-Nearest Neighbors (KNN) Anomaly Detector

## Overview

The K-Nearest Neighbors (KNN) detector is a high-performance anomaly detection algorithm that identifies outliers by comparing data points to their k nearest neighbors in the training dataset. It's particularly effective for detecting point anomalies in univariate time series data.

## Key Features

- **Optimized Performance**: Uses quickselect algorithm for O(n) average time complexity
- **Multiple Distance Metrics**: Supports Euclidean, Manhattan, and Cosine distances
- **Dynamic K Selection**: Automatically adjusts K based on dataset size
- **Continuous Learning**: Can adapt to new patterns over time
- **Normalization Support**: Optional data normalization for better accuracy
- **Weighted Voting**: Distance-weighted neighbor contributions

## How It Works

1. **Training Phase**: The detector stores a set of normal data points as reference
2. **Detection Phase**: For each new data point:
   - Finds the k nearest neighbors from the training set
   - Calculates the average distance to these neighbors
   - Flags as anomaly if distance exceeds threshold

## Configuration Options

```typescript
interface IKNNDetectorConfig {
  k?: number;                    // Number of neighbors (default: 5)
  distanceMetric?: string;       // 'euclidean' | 'manhattan' | 'cosine' (default: 'euclidean')
  anomalyThreshold?: number;     // Distance threshold for anomalies (default: 2.0)
  normalizeData?: boolean;       // Enable data normalization (default: true)
  maxTrainingSize?: number;      // Maximum training samples (default: 10000)
  minTrainingSamples?: number;   // Minimum samples for readiness (default: 20)
  dynamicK?: boolean;           // Auto-adjust K based on data (default: true)
  weightedVoting?: boolean;     // Use distance-weighted voting (default: true)
}
```

## Usage Examples

### Basic Usage

```typescript
import { ShieldModule } from '@usex/nest-shield';

@Module({
  imports: [
    ShieldModule.forRoot({
      anomalyDetection: {
        enabled: true,
        detectors: ['knn'],
        defaultConfig: {
          k: 5,
          anomalyThreshold: 2.0,
          normalizeData: true
        }
      }
    })
  ]
})
export class AppModule {}
```

### Advanced Configuration

```typescript
@Controller('metrics')
export class MetricsController {
  constructor(
    @Inject(DI_TOKENS.DETECTOR_FACTORY)
    private detectorFactory: IDetectorFactory
  ) {}

  @Post('analyze')
  async analyzeMetrics(@Body() data: MetricsDto) {
    const knnDetector = this.detectorFactory.create('knn');
    
    // Configure detector
    knnDetector.configure({
      k: 7,
      distanceMetric: 'manhattan',
      anomalyThreshold: 1.5,
      dynamicK: true,
      weightedVoting: true
    });

    // Train with historical data
    await knnDetector.train(historicalData);

    // Detect anomalies
    const anomalies = await knnDetector.detect([
      { value: data.cpuUsage, timestamp: Date.now(), source: 'cpu' }
    ]);

    return { anomalies };
  }
}
```

### With Shield Decorator

```typescript
@Controller('api')
export class ApiController {
  @Post('request')
  @Shield({
    anomalyDetection: {
      enabled: true,
      detectors: ['knn'],
      config: {
        k: 3,
        anomalyThreshold: 2.5,
        normalizeData: true
      },
      actions: {
        onAnomaly: 'alert' // 'alert' | 'block' | 'log'
      }
    }
  })
  async handleRequest(@Body() request: RequestDto) {
    // KNN detector automatically monitors request patterns
    return this.processRequest(request);
  }
}
```

## Performance Characteristics

### Time Complexity
- **Training**: O(n) where n is the number of training samples
- **Detection**: O(n) average case using quickselect, O(n log k) worst case
- **Space**: O(n) for storing training samples

### Optimization Features
1. **Quickselect Algorithm**: Efficiently finds k smallest distances without full sorting
2. **Caching**: Normalization parameters cached for performance
3. **Batch Processing**: Supports efficient batch anomaly detection
4. **Memory Management**: Configurable maximum training size to control memory usage

## Best Practices

### 1. Choosing K Value
```typescript
// For small datasets (< 100 samples)
k: 3

// For medium datasets (100-1000 samples)
k: 5

// For large datasets (> 1000 samples)
k: Math.floor(Math.sqrt(datasetSize))

// Or use dynamic K
dynamicK: true
```

### 2. Distance Metric Selection
- **Euclidean**: Best for continuous data with similar scales
- **Manhattan**: Better for data with different scales or outliers
- **Cosine**: Ideal for directional data or when magnitude doesn't matter

### 3. Threshold Tuning
```typescript
// Conservative (fewer false positives)
anomalyThreshold: 3.0

// Balanced
anomalyThreshold: 2.0

// Sensitive (more anomalies detected)
anomalyThreshold: 1.5
```

### 4. Training Data Management
```typescript
// Continuous learning pattern
const detector = detectorFactory.create('knn');

// Initial training
await detector.train(historicalData);

// Periodic retraining with recent data
setInterval(async () => {
  const recentData = await getRecentNormalData();
  await detector.train(recentData);
}, 3600000); // Every hour
```

## Comparison with Other Detectors

| Feature | KNN | Isolation Forest | Z-Score | Seasonal |
|---------|-----|------------------|---------|----------|
| Training Required | Yes | Yes | No | Yes |
| Handles Seasonality | No | Partially | No | Yes |
| Performance | Fast | Moderate | Very Fast | Moderate |
| Memory Usage | Moderate | High | Low | Moderate |
| Interpretability | High | Low | High | High |
| Best For | Point anomalies | Complex patterns | Simple outliers | Time-based patterns |

## Monitoring and Debugging

### Get Detector Statistics
```typescript
const stats = knnDetector.getStatistics();
console.log(stats);
// {
//   name: 'K-Nearest Neighbors Detector',
//   version: '1.0.0',
//   trained: true,
//   trainingDataSize: 5000,
//   config: { k: 5, ... },
//   normalizationParams: { mean: 50.2, std: 12.3 },
//   effectiveK: 5
// }
```

### Debug Anomaly Scores
```typescript
const anomalies = await knnDetector.detect(data);
anomalies.forEach(anomaly => {
  console.log({
    value: anomaly.data.value,
    score: anomaly.score,        // Distance to neighbors
    confidence: anomaly.confidence,
    severity: anomaly.severity,
    message: anomaly.message
  });
});
```

## Integration Examples

### With Metrics Service
```typescript
@Injectable()
export class MetricsMonitor {
  constructor(
    @Inject(DI_TOKENS.METRICS_SERVICE) private metrics: IMetricsCollector,
    @Inject(DI_TOKENS.ANOMALY_DETECTION_SERVICE) private anomalyService: IAnomalyDetectionService
  ) {}

  async monitorResponseTimes() {
    const detector = await this.anomalyService.getDetector('knn');
    
    this.metrics.on('response_time', async (value) => {
      const anomalies = await detector.detect([
        { value, timestamp: Date.now(), source: 'api' }
      ]);
      
      if (anomalies.length > 0) {
        this.metrics.increment('anomalies_detected', 1);
      }
    });
  }
}
```

### With Alerting
```typescript
@Injectable()
export class AnomalyAlertService {
  async handleKNNAnomalies(anomalies: IAnomaly[]) {
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'critical' && anomaly.confidence > 0.8) {
        await this.sendAlert({
          title: 'Critical Anomaly Detected',
          description: anomaly.message,
          score: anomaly.score,
          timestamp: anomaly.timestamp
        });
      }
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Detector Not Ready**
   - Ensure minimum training samples (default: 20)
   - Check training data quality

2. **Too Many False Positives**
   - Increase anomaly threshold
   - Increase K value
   - Ensure training data represents normal behavior

3. **Missing Anomalies**
   - Decrease anomaly threshold
   - Check if data needs normalization
   - Verify training data diversity

4. **Performance Issues**
   - Reduce maxTrainingSize
   - Enable data normalization to reduce scale effects
   - Consider using Manhattan distance for faster computation

## Advanced Topics

### Custom Distance Functions
```typescript
// Extend KNNDetector for custom distance metrics
class CustomKNNDetector extends KNNDetector {
  protected calculateDistance(a: number, b: number): number {
    // Custom distance logic
    return Math.abs(Math.log(a) - Math.log(b));
  }
}
```

### Ensemble with Other Detectors
```typescript
@Shield({
  anomalyDetection: {
    detectors: ['knn', 'zscore', 'isolation-forest'],
    voting: 'majority', // Combine multiple detector results
    config: {
      knn: { k: 5, anomalyThreshold: 2.0 },
      zscore: { threshold: 3.0 },
      'isolation-forest': { contamination: 0.1 }
    }
  }
})
```

## References

- [K-Nearest Neighbors Algorithm](https://en.wikipedia.org/wiki/K-nearest_neighbors_algorithm)
- [Quickselect Algorithm](https://en.wikipedia.org/wiki/Quickselect)
- [Anomaly Detection in Time Series](https://arxiv.org/abs/2002.04236)