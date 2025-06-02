# Detector Management API

The Detector Management API provides comprehensive control over the anomaly detection system, exposing advanced features that were previously hidden within detector implementations.

## Overview

The management API enables:
- Real-time detector statistics and health monitoring
- Data quality analysis and validation
- Model retraining and feedback integration
- Seasonal pattern analysis and forecasting
- Baseline management for statistical detectors
- Feature importance analysis for ML detectors

## API Endpoints

### Get Detector Statistics

```bash
GET /api/anomaly-detection/management/stats/{detector?}
```

Returns comprehensive statistics for all detectors or a specific detector.

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
          "count": 10000
        }
      }
    },
    {
      "name": "isolation-forest",
      "type": "IsolationForestDetector",
      "ready": true,
      "stats": {
        "numTrees": 100,
        "averageDepth": 8.5,
        "totalNodes": 15420
      },
      "featureImportance": {
        "response_time": 0.45,
        "error_rate": 0.35,
        "cpu_usage": 0.20
      }
    }
  ],
  "timestamp": 1736169600000
}
```

### Analyze Data Quality

```bash
POST /api/anomaly-detection/management/quality/{detector}
Content-Type: application/json

[
  {
    "metricName": "response_time",
    "value": 125,
    "timestamp": 1736169600000
  }
]
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
  "timestamp": 1736169600000
}
```

### Batch Anomaly Scoring

```bash
POST /api/anomaly-detection/management/score/{detector}
Content-Type: application/json

[
  {
    "metricName": "response_time",
    "value": 125,
    "timestamp": 1736169600000
  }
]
```

Get anomaly scores for multiple data points in a single request.

**Response Example:**
```json
{
  "success": true,
  "detector": "isolation-forest",
  "scores": [0.12, 0.85, 0.23, 0.91],
  "timestamp": 1736169600000
}
```

### Retrain Model

```bash
POST /api/anomaly-detection/management/retrain/{detector}
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

### Update Model with Feedback

```bash
POST /api/anomaly-detection/management/feedback/{detector}
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

### Get Seasonal Patterns

```bash
GET /api/anomaly-detection/management/patterns/{detector}
```

Retrieve learned seasonal patterns from the seasonal detector.

**Response Example:**
```json
{
  "success": true,
  "detector": "seasonal",
  "patterns": {
    "api_gateway": {
      "hourly": [0.8, 0.7, 0.6, ...],
      "daily": [0.9, 0.85, 0.8, ...],
      "weekly": [1.0, 0.95, 0.9, ...]
    }
  },
  "timestamp": 1736169600000
}
```

### Predict Future Values

```bash
POST /api/anomaly-detection/management/predict/{detector}
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
    "values": [125, 130, 128, ...],
    "timestamps": [1736169600000, 1736173200000, ...],
    "confidence": {
      "lower": [120, 125, 123, ...],
      "upper": [130, 135, 133, ...]
    }
  },
  "timestamp": 1736169600000
}
```

### Get/Set Baseline

```bash
GET /api/anomaly-detection/management/baseline/{detector}

PUT /api/anomaly-detection/management/baseline/{detector}
Content-Type: application/json

{
  "mean": 100,
  "stdDev": 15,
  "count": 10000
}
```

Manage statistical baselines for Z-score based detection.

## Integration Examples

### Python Client Example

```python
import requests
import json

class AnomalyDetectorManager:
    def __init__(self, base_url):
        self.base_url = base_url
        
    def get_detector_stats(self, detector=None):
        url = f"{self.base_url}/stats"
        if detector:
            url += f"/{detector}"
        return requests.get(url).json()
    
    def analyze_data_quality(self, detector, data):
        url = f"{self.base_url}/quality/{detector}"
        return requests.post(url, json=data).json()
    
    def retrain_model(self, detector, source, data):
        url = f"{self.base_url}/retrain/{detector}"
        payload = {"source": source, "data": data}
        return requests.post(url, json=payload).json()
    
    def predict_values(self, detector, source, steps=24):
        url = f"{self.base_url}/predict/{detector}"
        payload = {
            "source": source,
            "steps": steps,
            "includeConfidenceInterval": True
        }
        return requests.post(url, json=payload).json()

# Usage
manager = AnomalyDetectorManager("http://api.example.com/api/anomaly-detection/management")

# Check detector health
stats = manager.get_detector_stats()
for detector in stats['data']:
    print(f"{detector['name']}: {'Ready' if detector['ready'] else 'Not Ready'}")

# Analyze data quality before sending
quality = manager.analyze_data_quality('statistical', recent_data)
if quality['quality']['overallScore'] < 0.8:
    print("Warning: Low data quality detected")

# Retrain model periodically
manager.retrain_model('machine-learning', 'api_gateway', training_data)

# Predict future values for capacity planning
predictions = manager.predict_values('seasonal', 'api_gateway', steps=48)
```

### Node.js Client Example

```javascript
const axios = require('axios');

class AnomalyDetectorManager {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async getDetectorStats(detector) {
    const url = detector 
      ? `${this.baseUrl}/stats/${detector}`
      : `${this.baseUrl}/stats`;
    const response = await axios.get(url);
    return response.data;
  }

  async batchScore(detector, data) {
    const response = await axios.post(
      `${this.baseUrl}/score/${detector}`,
      data
    );
    return response.data;
  }

  async updateWithFeedback(detector, source, data, feedback) {
    const response = await axios.post(
      `${this.baseUrl}/feedback/${detector}`,
      { source, data, feedback }
    );
    return response.data;
  }
}

// Usage
const manager = new AnomalyDetectorManager('http://api.example.com/api/anomaly-detection/management');

// Batch scoring for visualization
const scores = await manager.batchScore('isolation-forest', dataPoints);
const anomalousIndices = scores.scores
  .map((score, idx) => ({ score, idx }))
  .filter(item => item.score > 0.8)
  .map(item => item.idx);

// Provide feedback to improve model
await manager.updateWithFeedback(
  'machine-learning',
  'api_gateway',
  dataPoints,
  dataPoints.map((_, idx) => !anomalousIndices.includes(idx))
);
```

## Best Practices

### 1. Regular Model Maintenance

```javascript
// Schedule regular model quality checks
setInterval(async () => {
  const stats = await manager.getDetectorStats();
  
  for (const detector of stats.data) {
    if (detector.type === 'MachineLearningDetector') {
      const quality = await manager.analyzeDataQuality(
        detector.name, 
        recentData
      );
      
      if (quality.quality.overallScore < 0.7) {
        await manager.retrainModel(
          detector.name,
          'scheduled_retrain',
          trainingData
        );
      }
    }
  }
}, 24 * 60 * 60 * 1000); // Daily
```

### 2. Adaptive Threshold Management

```javascript
// Adjust baselines based on business hours
const businessHours = { start: 9, end: 17 };
const currentHour = new Date().getHours();

if (currentHour >= businessHours.start && currentHour <= businessHours.end) {
  // Use tighter thresholds during business hours
  await manager.setBaseline('zscore', {
    mean: businessMetrics.mean,
    stdDev: businessMetrics.stdDev * 0.8, // Tighter bounds
    count: businessMetrics.count
  });
} else {
  // Relax thresholds during off-hours
  await manager.setBaseline('zscore', {
    mean: offHoursMetrics.mean,
    stdDev: offHoursMetrics.stdDev * 1.2, // Looser bounds
    count: offHoursMetrics.count
  });
}
```

### 3. Feedback Loop Integration

```javascript
// Integrate with ticketing system
async function processIncidentFeedback(incidentId, wasAnomaly) {
  const incident = await getIncident(incidentId);
  const relatedData = await getMetricsAroundTime(
    incident.timestamp,
    incident.metric
  );
  
  // Update model with feedback
  await manager.updateWithFeedback(
    'machine-learning',
    incident.source,
    relatedData,
    relatedData.map(() => wasAnomaly)
  );
  
  // Log for audit
  await auditLog.record({
    action: 'anomaly_feedback',
    incidentId,
    wasAnomaly,
    timestamp: Date.now()
  });
}
```

### 4. Predictive Alerting

```javascript
// Use predictions for proactive alerts
async function checkFutureTrends() {
  const predictions = await manager.predictValues(
    'seasonal',
    'api_gateway',
    24 // Next 24 hours
  );
  
  const futureAnomalies = predictions.predictions.values
    .map((value, idx) => ({
      value,
      timestamp: predictions.predictions.timestamps[idx],
      exceedsUpper: value > predictions.predictions.confidence.upper[idx],
      exceedsLower: value < predictions.predictions.confidence.lower[idx]
    }))
    .filter(p => p.exceedsUpper || p.exceedsLower);
  
  if (futureAnomalies.length > 0) {
    await sendAlert({
      type: 'predictive',
      message: `Potential anomalies predicted in next 24 hours`,
      predictions: futureAnomalies
    });
  }
}
```

## Monitoring Dashboard Integration

The management API is designed to power monitoring dashboards:

```javascript
// Dashboard data aggregation
async function getDashboardData() {
  const [stats, patterns, predictions] = await Promise.all([
    manager.getDetectorStats(),
    manager.getSeasonalPatterns('seasonal'),
    manager.predictValues('seasonal', 'api_gateway', 24)
  ]);
  
  return {
    detectorHealth: stats.data.map(d => ({
      name: d.name,
      status: d.ready ? 'healthy' : 'unhealthy',
      ...(d.featureImportance && {
        topFeatures: Object.entries(d.featureImportance)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([feature]) => feature)
      })
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

## Security Considerations

1. **Authentication**: All management endpoints should be protected with proper authentication
2. **Rate Limiting**: Apply stricter rate limits to training endpoints
3. **Data Validation**: Validate all incoming data to prevent model poisoning
4. **Audit Logging**: Log all management operations for compliance
5. **Access Control**: Implement role-based access for different operations

## Performance Tips

1. **Batch Operations**: Use batch scoring for large datasets instead of individual requests
2. **Async Processing**: Retraining operations should be queued and processed asynchronously
3. **Caching**: Cache detector stats and patterns with appropriate TTLs
4. **Pagination**: Implement pagination for large result sets
5. **Compression**: Enable compression for large data transfers

## Troubleshooting

### Common Issues

1. **Detector Not Ready**
   - Check if the detector has been trained with sufficient data
   - Verify the detector configuration is valid
   - Check logs for initialization errors

2. **Low Quality Scores**
   - Review data validation rules
   - Check for data drift or schema changes
   - Verify data collection pipeline integrity

3. **Poor Prediction Accuracy**
   - Ensure sufficient historical data for pattern learning
   - Check if seasonal patterns are stable
   - Consider retraining with recent data

4. **Model Performance Degradation**
   - Monitor feature importance changes
   - Check for concept drift in data
   - Schedule regular retraining cycles