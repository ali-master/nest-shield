# Detector Management API

The Detector Management API provides comprehensive control over NestShield's anomaly detection system, exposing advanced features for monitoring, tuning, and maintaining detectors in production environments.

## Overview

The management API enables:
- Real-time detector statistics and health monitoring
- Data quality analysis and validation
- Model retraining and feedback integration
- Seasonal pattern analysis and forecasting
- Baseline management for statistical detectors
- Feature importance analysis for ML detectors
- Threshold management and adaptive adjustments
- Ensemble strategy configuration

## Implementation

**Controller**: `src/anomaly-detection/controllers/detector-management.controller.ts`
**Service**: `src/anomaly-detection/services/detector-management.service.ts`

## API Endpoints

### Detector Statistics

#### Get Detector Statistics
```http
GET /anomaly-detection/detectors/stats?detectorName={detector}
```

Returns comprehensive statistics for all detectors or a specific detector.

**Query Parameters:**
- `detectorName` (optional): Specific detector to query

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "name": "zscore",
      "type": "ZScoreDetector",
      "ready": true,
      "stats": {
        "baseline": {
          "mean": 45.2,
          "stdDev": 12.3,
          "sampleSize": 10000,
          "lastUpdated": 1736169600000
        },
        "rollingWindow": 100,
        "adaptiveThreshold": 3.2
      }
    },
    {
      "name": "isolation-forest",
      "type": "IsolationForestDetector",
      "ready": true,
      "stats": {
        "numTrees": 100,
        "averageDepth": 8.5,
        "totalNodes": 15420,
        "subsampleSize": 256
      },
      "featureImportance": {
        "value": 0.25,
        "value_normalized": 0.20,
        "rate_of_change": 0.18,
        "local_variance": 0.15,
        "z_score": 0.12,
        "moving_average_ratio": 0.10
      }
    },
    {
      "name": "seasonal",
      "type": "SeasonalAnomalyDetector",
      "ready": true,
      "stats": {
        "patternsLearned": 3,
        "dominantPeriod": "daily",
        "seasonalStrength": 0.85
      },
      "patterns": {
        "api_gateway": {
          "baseline": 50.2,
          "hourlyPattern": [0.8, 0.7, 0.6, /*...24 values...*/],
          "dailyPattern": [1.0, 0.95, 0.9, /*...7 values...*/],
          "trend": 0.05,
          "strength": 0.82
        }
      }
    }
  ],
  "timestamp": 1736169600000
}
```

### Data Quality Analysis

#### Analyze Data Quality
```http
POST /anomaly-detection/detectors/{detectorName}/data-quality
Content-Type: application/json

{
  "data": [
    {
      "metricName": "response_time",
      "value": 125,
      "timestamp": 1736169600000,
      "source": "api_gateway"
    }
  ]
}
```

Analyzes the quality of incoming data using detector-specific quality checks.

**Response Example:**
```json
{
  "success": true,
  "detector": "statistical",
  "quality": {
    "completeness": 0.98,
    "consistency": 0.95,
    "accuracy": 0.99,
    "validity": 1.0,
    "uniqueness": 0.97,
    "overallScore": 0.978
  },
  "issues": [
    {
      "type": "missing_values",
      "severity": "low",
      "count": 2,
      "percentage": 0.02
    }
  ],
  "recommendations": [
    "Data quality is excellent. No immediate action required."
  ],
  "timestamp": 1736169600000
}
```

### Batch Operations

#### Batch Anomaly Scoring
```http
POST /anomaly-detection/detectors/{detectorName}/batch-score
Content-Type: application/json

{
  "data": [
    {
      "metricName": "response_time",
      "value": 125,
      "timestamp": 1736169600000
    },
    {
      "metricName": "response_time", 
      "value": 850,
      "timestamp": 1736169660000
    }
  ]
}
```

Get anomaly scores for multiple data points in a single request.

**Response Example:**
```json
{
  "success": true,
  "detector": "isolation-forest",
  "scores": [0.12, 0.85],
  "classifications": ["normal", "anomaly"],
  "processingTime": 15,
  "timestamp": 1736169600000
}
```

### Model Management

#### Retrain Model
```http
POST /anomaly-detection/detectors/{detectorName}/retrain
Content-Type: application/json

{
  "source": "api_gateway",
  "data": [
    {
      "metricName": "response_time",
      "value": 125,
      "timestamp": 1736169600000
    }
  ]
}
```

Retrain a detector's model with new training data.

**Response Example:**
```json
{
  "message": "Model retrained successfully",
  "trainingMetrics": {
    "dataPoints": 10000,
    "trainingTime": 2500,
    "validationScore": 0.92,
    "modelSize": "2.4MB"
  },
  "timestamp": 1736169600000
}
```

#### Update Model with Feedback
```http
POST /anomaly-detection/detectors/{detectorName}/feedback
Content-Type: application/json

{
  "source": "api_gateway",
  "data": [
    {
      "metricName": "response_time",
      "value": 125,
      "timestamp": 1736169600000
    }
  ],
  "feedback": [true, false, true, true]
}
```

Update model with human feedback on anomaly classifications.

**Response Example:**
```json
{
  "message": "Model updated with feedback",
  "feedbackProcessed": 4,
  "modelAccuracyImprovement": 0.03,
  "timestamp": 1736169600000
}
```

### Seasonal Analysis

#### Get Seasonal Patterns
```http
GET /anomaly-detection/detectors/{detectorName}/seasonal-patterns
```

Retrieve learned seasonal patterns from the seasonal detector.

**Response Example:**
```json
{
  "success": true,
  "detector": "seasonal",
  "patterns": {
    "api_gateway": {
      "baseline": 50.2,
      "dominantPeriod": "daily",
      "strength": 0.85,
      "hourly": [0.8, 0.7, 0.6, /*...21 more values...*/],
      "daily": [0.9, 0.85, 0.8, /*...4 more values...*/],
      "weekly": [1.0, 0.95, 0.9, 0.88],
      "monthly": [1.2, 1.1, 1.0, /*...9 more values...*/],
      "volatilityByHour": [0.5, 0.4, 0.3, /*...21 more values...*/],
      "lastUpdated": 1736169600000
    }
  },
  "timestamp": 1736169600000
}
```

#### Predict Future Values
```http
POST /anomaly-detection/detectors/{detectorName}/predict
Content-Type: application/json

{
  "source": "api_gateway",
  "steps": 24,
  "includeConfidenceInterval": true
}
```

Predict future values based on seasonal patterns.

**Response Example:**
```json
{
  "success": true,
  "detector": "seasonal",
  "predictions": {
    "values": [125, 130, 128, /*...21 more values...*/],
    "timestamps": [1736169600000, 1736173200000, /*...*/],
    "confidence": {
      "lower": [120, 125, 123, /*...21 more values...*/],
      "upper": [130, 135, 133, /*...21 more values...*/]
    }
  },
  "metadata": {
    "horizon": 24,
    "pattern": "daily",
    "confidence": 0.85
  },
  "timestamp": 1736169600000
}
```

### Baseline Management

#### Get Baseline
```http
GET /anomaly-detection/detectors/{detectorName}/baseline
```

Retrieve current baseline for statistical detectors.

**Response Example:**
```json
{
  "success": true,
  "detector": "zscore",
  "baseline": {
    "mean": 100.5,
    "stdDev": 15.2,
    "sampleSize": 10000,
    "lastUpdated": 1736169600000,
    "confidence": 0.95
  },
  "timestamp": 1736169600000
}
```

#### Set Baseline
```http
PUT /anomaly-detection/detectors/{detectorName}/baseline
Content-Type: application/json

{
  "mean": 100,
  "stdDev": 15,
  "count": 10000
}
```

Manually set baseline for statistical detectors.

**Response Example:**
```json
{
  "message": "Baseline updated successfully",
  "previousBaseline": {
    "mean": 95.2,
    "stdDev": 12.8
  },
  "newBaseline": {
    "mean": 100,
    "stdDev": 15
  },
  "timestamp": 1736169600000
}
```

### Threshold Management

#### Get Thresholds
```http
GET /anomaly-detection/detectors/{detectorName}/thresholds?source={source}
```

Retrieve current thresholds for a detector.

**Response Example:**
```json
{
  "success": true,
  "detector": "threshold",
  "thresholds": {
    "api_gateway": {
      "static": {
        "upper": 100,
        "lower": 0,
        "upperWarning": 80,
        "lowerWarning": 20
      },
      "adaptive": {
        "enabled": true,
        "current": {
          "upper": 105.2,
          "lower": -2.1
        },
        "learningRate": 0.1
      }
    }
  },
  "timestamp": 1736169600000
}
```

#### Set Threshold
```http
PUT /anomaly-detection/detectors/{detectorName}/thresholds/{source}
Content-Type: application/json

{
  "upper": 100,
  "lower": 0,
  "upperWarning": 80,
  "lowerWarning": 20
}
```

Update thresholds for a specific source.

#### Get Adaptive Thresholds
```http
GET /anomaly-detection/detectors/{detectorName}/adaptive-thresholds
```

Get current adaptive threshold configuration.

#### Enable/Disable Adaptive Thresholds
```http
PUT /anomaly-detection/detectors/{detectorName}/adaptive-thresholds/{source}
Content-Type: application/json

{
  "enabled": true
}
```

### Ensemble Management

#### Set Ensemble Strategy
```http
PUT /anomaly-detection/detectors/{detectorName}/ensemble-strategy
Content-Type: application/json

{
  "strategy": "adaptive_weighted"
}
```

Update ensemble strategy for composite detector.

**Available Strategies:**
- `majority_vote`: Simple democratic voting
- `weighted_average`: Performance-based weights
- `adaptive_weighted`: Context and performance adaptation
- `stacking`: Meta-learning approach
- `hierarchical`: Multi-stage pipeline

#### Get Detector Performance
```http
GET /anomaly-detection/detectors/{detectorName}/detector-performance
```

Get performance metrics for composite detector's sub-detectors.

**Response Example:**
```json
{
  "success": true,
  "detector": "composite",
  "performance": {
    "Z-Score Detector": {
      "accuracy": 0.85,
      "precision": 0.80,
      "recall": 0.88,
      "f1Score": 0.84,
      "responseTime": 2.5,
      "weight": 1.0
    },
    "Isolation Forest Detector": {
      "accuracy": 0.92,
      "precision": 0.89,
      "recall": 0.90,
      "f1Score": 0.895,
      "responseTime": 15.2,
      "weight": 1.2
    }
  },
  "timestamp": 1736169600000
}
```

#### Enable/Disable Child Detector
```http
PUT /anomaly-detection/detectors/{detectorName}/child-detector/{childDetectorName}/enabled
Content-Type: application/json

{
  "enabled": false
}
```

Enable or disable a specific detector within the composite ensemble.

#### Adjust Detector Weight
```http
PUT /anomaly-detection/detectors/{detectorName}/child-detector/{childDetectorName}/weight
Content-Type: application/json

{
  "weight": 1.5
}
```

Adjust the weight of a detector in the ensemble.

#### Get Ensemble Statistics
```http
GET /anomaly-detection/detectors/{detectorName}/ensemble-statistics
```

Get comprehensive ensemble statistics.

**Response Example:**
```json
{
  "success": true,
  "detector": "composite",
  "statistics": {
    "strategy": "adaptive_weighted",
    "detectorCount": 6,
    "activeDetectorCount": 5,
    "detectorStats": [
      {
        "name": "Z-Score Detector",
        "isReady": true,
        "weight": 1.0,
        "performance": {
          "accuracy": 0.85,
          "responseTime": 2.5
        }
      }
    ],
    "lastUpdated": 1736169600000
  },
  "timestamp": 1736169600000
}
```

#### Provide Detector Feedback
```http
POST /anomaly-detection/detectors/{detectorName}/child-detector/{childDetectorName}/feedback
Content-Type: application/json

{
  "feedback": [
    {
      "dataPoint": {
        "metricName": "response_time",
        "value": 125,
        "timestamp": 1736169600000
      },
      "isAnomaly": true,
      "confidence": 0.85,
      "feedback": "correct",
      "timestamp": 1736169600000
    }
  ]
}
```

Provide feedback to improve detector performance.

### Machine Learning Features

#### Get Feature Importance
```http
GET /anomaly-detection/detectors/{detectorName}/feature-importance/{source}
```

Get feature importance for ML detectors.

**Response Example:**
```json
{
  "success": true,
  "detector": "isolation-forest",
  "source": "api_gateway",
  "featureImportance": {
    "value": 0.25,
    "value_normalized": 0.20,
    "rate_of_change": 0.18,
    "local_variance": 0.15,
    "z_score": 0.12,
    "moving_average_ratio": 0.10,
    "percentile_rank": 0.08,
    "time_since_last_spike": 0.02
  },
  "timestamp": 1736169600000
}
```

### Statistical Models

#### Get Statistical Models
```http
GET /anomaly-detection/detectors/{detectorName}/statistical-models
```

Get information about statistical models used.

**Response Example:**
```json
{
  "success": true,
  "detector": "statistical",
  "models": {
    "zscore": {
      "enabled": true,
      "weight": 0.3,
      "parameters": {
        "threshold": 3.0
      }
    },
    "iqr": {
      "enabled": true,
      "weight": 0.2,
      "parameters": {
        "multiplier": 1.5
      }
    },
    "grubbs": {
      "enabled": true,
      "weight": 0.3,
      "parameters": {
        "alpha": 0.05
      }
    },
    "modifiedZScore": {
      "enabled": true,
      "weight": 0.2,
      "parameters": {
        "threshold": 3.5
      }
    }
  },
  "timestamp": 1736169600000
}
```

## Integration Examples

### Python Client

```python
import requests
import json
from typing import Dict, List, Optional

class DetectorManagementClient:
    def __init__(self, base_url: str):
        self.base_url = f"{base_url}/anomaly-detection/detectors"
        
    def get_detector_stats(self, detector_name: Optional[str] = None) -> Dict:
        """Get detector statistics"""
        url = f"{self.base_url}/stats"
        if detector_name:
            url += f"?detectorName={detector_name}"
        return requests.get(url).json()
    
    def analyze_data_quality(self, detector_name: str, data: List[Dict]) -> Dict:
        """Analyze data quality"""
        url = f"{self.base_url}/{detector_name}/data-quality"
        return requests.post(url, json={"data": data}).json()
    
    def batch_score(self, detector_name: str, data: List[Dict]) -> Dict:
        """Get batch anomaly scores"""
        url = f"{self.base_url}/{detector_name}/batch-score"
        return requests.post(url, json={"data": data}).json()
    
    def retrain_model(self, detector_name: str, source: str, data: List[Dict]) -> Dict:
        """Retrain detector model"""
        url = f"{self.base_url}/{detector_name}/retrain"
        payload = {"source": source, "data": data}
        return requests.post(url, json=payload).json()
    
    def update_with_feedback(self, detector_name: str, source: str, 
                           data: List[Dict], feedback: List[bool]) -> Dict:
        """Update model with feedback"""
        url = f"{self.base_url}/{detector_name}/feedback"
        payload = {"source": source, "data": data, "feedback": feedback}
        return requests.post(url, json=payload).json()
    
    def get_seasonal_patterns(self, detector_name: str) -> Dict:
        """Get seasonal patterns"""
        url = f"{self.base_url}/{detector_name}/seasonal-patterns"
        return requests.get(url).json()
    
    def predict_values(self, detector_name: str, source: str, 
                      steps: int = 24, include_confidence: bool = True) -> Dict:
        """Predict future values"""
        url = f"{self.base_url}/{detector_name}/predict"
        payload = {
            "source": source,
            "steps": steps,
            "includeConfidenceInterval": include_confidence
        }
        return requests.post(url, json=payload).json()
    
    def set_baseline(self, detector_name: str, mean: float, 
                    std_dev: float, count: int) -> Dict:
        """Set detector baseline"""
        url = f"{self.base_url}/{detector_name}/baseline"
        payload = {"mean": mean, "stdDev": std_dev, "count": count}
        return requests.put(url, json=payload).json()
    
    def set_ensemble_strategy(self, detector_name: str, strategy: str) -> Dict:
        """Set ensemble strategy"""
        url = f"{self.base_url}/{detector_name}/ensemble-strategy"
        return requests.put(url, json={"strategy": strategy}).json()

# Usage Example
client = DetectorManagementClient("http://localhost:3000")

# Monitor detector health
stats = client.get_detector_stats()
for detector in stats['data']:
    print(f"{detector['name']}: {'Ready' if detector['ready'] else 'Not Ready'}")

# Analyze data quality
sample_data = [
    {"metricName": "cpu_usage", "value": 75.5, "timestamp": 1736169600000},
    {"metricName": "cpu_usage", "value": 82.1, "timestamp": 1736169660000}
]
quality = client.analyze_data_quality('statistical', sample_data)
print(f"Data quality score: {quality['quality']['overallScore']:.3f}")

# Get batch scores
scores = client.batch_score('isolation-forest', sample_data)
print(f"Anomaly scores: {scores['scores']}")

# Retrain with new data
training_data = [/* training samples */]
result = client.retrain_model('machine-learning', 'api_gateway', training_data)
print(f"Training completed in {result['trainingMetrics']['trainingTime']}ms")

# Get seasonal forecast
predictions = client.predict_values('seasonal', 'api_gateway', steps=48)
print(f"Next 48 hour predictions: {predictions['predictions']['values'][:5]}...")
```

### Node.js Client

```javascript
const axios = require('axios');

class DetectorManagementClient {
  constructor(baseUrl) {
    this.baseUrl = `${baseUrl}/anomaly-detection/detectors`;
  }

  async getDetectorStats(detectorName) {
    const url = detectorName 
      ? `${this.baseUrl}/stats?detectorName=${detectorName}`
      : `${this.baseUrl}/stats`;
    const response = await axios.get(url);
    return response.data;
  }

  async batchScore(detectorName, data) {
    const response = await axios.post(
      `${this.baseUrl}/${detectorName}/batch-score`,
      { data }
    );
    return response.data;
  }

  async updateWithFeedback(detectorName, source, data, feedback) {
    const response = await axios.post(
      `${this.baseUrl}/${detectorName}/feedback`,
      { source, data, feedback }
    );
    return response.data;
  }

  async setEnsembleStrategy(detectorName, strategy) {
    const response = await axios.put(
      `${this.baseUrl}/${detectorName}/ensemble-strategy`,
      { strategy }
    );
    return response.data;
  }

  async adjustDetectorWeight(detectorName, childDetectorName, weight) {
    const response = await axios.put(
      `${this.baseUrl}/${detectorName}/child-detector/${childDetectorName}/weight`,
      { weight }
    );
    return response.data;
  }

  async getFeatureImportance(detectorName, source) {
    const response = await axios.get(
      `${this.baseUrl}/${detectorName}/feature-importance/${source}`
    );
    return response.data;
  }
}

// Usage
const client = new DetectorManagementClient('http://localhost:3000');

// Monitor ensemble performance
const performance = await client.getDetectorStats('composite');
console.log('Composite detector status:', performance.data[0].ready);

// Batch score for visualization
const dataPoints = [/* your data points */];
const scores = await client.batchScore('isolation-forest', dataPoints);
const anomalousIndices = scores.scores
  .map((score, idx) => ({ score, idx }))
  .filter(item => item.score > 0.8)
  .map(item => item.idx);

console.log(`Found ${anomalousIndices.length} anomalies`);

// Adjust ensemble configuration
await client.setEnsembleStrategy('composite', 'adaptive_weighted');
await client.adjustDetectorWeight('composite', 'Machine Learning Detector', 1.5);

// Analyze feature importance
const importance = await client.getFeatureImportance('isolation-forest', 'api_gateway');
const topFeatures = Object.entries(importance.featureImportance)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 3);

console.log('Top features:', topFeatures);
```

## Best Practices

### 1. Regular Health Monitoring

```javascript
// Monitor detector health every 5 minutes
setInterval(async () => {
  const stats = await client.getDetectorStats();
  
  for (const detector of stats.data) {
    if (!detector.ready) {
      console.warn(`Detector ${detector.name} is not ready`);
      // Trigger alerting system
    }
    
    // Check for performance degradation
    if (detector.performance?.responseTime > 100) {
      console.warn(`High latency detected for ${detector.name}`);
    }
  }
}, 5 * 60 * 1000);
```

### 2. Adaptive Threshold Management

```javascript
// Adjust thresholds based on business context
async function adjustThresholdsForBusinessHours() {
  const hour = new Date().getHours();
  const isBusinessHours = hour >= 9 && hour <= 17;
  
  if (isBusinessHours) {
    // Tighter thresholds during business hours
    await client.setThreshold('threshold', 'api_gateway', {
      upper: 500,  // 500ms response time
      lower: 0
    });
  } else {
    // Relaxed thresholds during off-hours
    await client.setThreshold('threshold', 'api_gateway', {
      upper: 1000, // 1s response time
      lower: 0
    });
  }
}
```

### 3. Continuous Model Improvement

```javascript
// Implement feedback loop
async function processFeedback(incidentData) {
  const { detectorName, source, dataPoints, wasAnomaly } = incidentData;
  
  // Prepare feedback data
  const feedback = dataPoints.map(() => wasAnomaly);
  
  // Update model
  await client.updateWithFeedback(detectorName, source, dataPoints, feedback);
  
  // Log for audit
  console.log(`Feedback provided to ${detectorName}: ${wasAnomaly ? 'anomaly' : 'normal'}`);
}
```

### 4. Performance Optimization

```javascript
// Optimize detector selection based on data characteristics
async function optimizeDetectorSelection(dataCharacteristics) {
  if (dataCharacteristics.isHighVolume && dataCharacteristics.requiresLowLatency) {
    // Use fast detectors
    await client.setEnsembleStrategy('composite', 'hierarchical');
    await client.disableDetector('composite', 'Machine Learning Detector');
  } else if (dataCharacteristics.hasComplexPatterns) {
    // Use sophisticated detectors
    await client.setEnsembleStrategy('composite', 'adaptive_weighted');
    await client.adjustDetectorWeight('composite', 'Machine Learning Detector', 1.5);
  }
}
```

## Error Handling

All API endpoints return standardized error responses:

```json
{
  "success": false,
  "error": {
    "code": "DETECTOR_NOT_READY",
    "message": "Detector 'machine-learning' is not ready for inference",
    "details": {
      "detectorName": "machine-learning",
      "trainingRequired": true,
      "estimatedTrainingTime": "5 minutes"
    }
  },
  "timestamp": 1736169600000
}
```

Common error codes:
- `DETECTOR_NOT_FOUND`: Detector doesn't exist
- `DETECTOR_NOT_READY`: Detector needs training
- `INVALID_DATA_FORMAT`: Data format validation failed
- `OPERATION_NOT_SUPPORTED`: Feature not available for detector
- `RATE_LIMIT_EXCEEDED`: Too many requests

## Security Considerations

1. **Authentication**: All endpoints require proper authentication
2. **Rate Limiting**: Stricter limits on training/feedback endpoints
3. **Data Validation**: Comprehensive input validation
4. **Audit Logging**: All management operations are logged
5. **Access Control**: Role-based permissions for different operations

## Performance Guidelines

1. **Batch Operations**: Use batch scoring for large datasets
2. **Async Processing**: Training operations are queued and processed asynchronously
3. **Caching**: Statistics and patterns are cached with appropriate TTLs
4. **Pagination**: Large result sets support pagination
5. **Compression**: Enable compression for large data transfers

## Monitoring and Alerting

The management API integrates with monitoring systems:

```javascript
// Example monitoring dashboard data
async function getDashboardData() {
  const [stats, patterns, predictions] = await Promise.all([
    client.getDetectorStats(),
    client.getSeasonalPatterns('seasonal'),
    client.predictValues('seasonal', 'api_gateway', 24)
  ]);
  
  return {
    detectorHealth: stats.data.map(d => ({
      name: d.name,
      status: d.ready ? 'healthy' : 'unhealthy',
      lastActivity: d.stats?.lastUpdated || 0
    })),
    seasonalInsights: {
      patterns: patterns.patterns,
      nextDayForecast: predictions.predictions
    },
    systemHealth: {
      totalDetectors: stats.data.length,
      readyDetectors: stats.data.filter(d => d.ready).length,
      lastUpdate: stats.timestamp
    }
  };
}
```

The Detector Management API provides comprehensive control over NestShield's anomaly detection system, enabling sophisticated monitoring, tuning, and maintenance operations for production environments.