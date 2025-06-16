# REST API Reference

This document provides comprehensive documentation for the NestShield Dashboard REST API endpoints.

## Base URL

```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

## Authentication

The API uses session-based authentication. Include the session cookie in your requests.

```http
GET /api/monitoring/metrics
Cookie: next-auth.session-token=your-session-token
```

## Common Headers

```http
Content-Type: application/json
Accept: application/json
X-Requested-With: XMLHttpRequest
```

## Rate Limiting

- **Rate Limit**: 100 requests per 15-minute window
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "value": "invalid-email",
      "expected": "valid email address"
    },
    "timestamp": "2025-01-15T10:30:00Z",
    "path": "/api/monitoring/alerts",
    "requestId": "req_123456789"
  }
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error
- `503` - Service Unavailable

## Health Endpoints

### Get Application Health

```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "uptime": 3600000,
  "version": "1.0.0",
  "environment": "production"
}
```

### Get Detailed Health

```http
GET /api/health/detailed
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "uptime": 3600000,
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 15,
      "lastCheck": "2025-01-15T10:29:55Z"
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2,
      "lastCheck": "2025-01-15T10:29:55Z"
    },
    "nestshield-core": {
      "status": "healthy",
      "responseTime": 45,
      "lastCheck": "2025-01-15T10:29:50Z"
    }
  },
  "system": {
    "memory": {
      "used": 134217728,
      "total": 2147483648,
      "usage": 6.25
    },
    "cpu": {
      "usage": 15.5,
      "loadAverage": [1.2, 1.5, 1.8]
    }
  }
}
```

## Monitoring Endpoints

### Get System Metrics

```http
GET /api/monitoring/metrics
```

**Query Parameters:**
- `timeRange` (optional): `1h`, `6h`, `24h`, `7d`, `30d` (default: `1h`)
- `granularity` (optional): `1m`, `5m`, `1h`, `1d` (default: `5m`)

**Response:**
```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "timeRange": "1h",
  "metrics": {
    "system": {
      "cpu": {
        "current": 15.5,
        "average": 12.3,
        "peak": 45.2,
        "history": [
          { "timestamp": "2025-01-15T09:30:00Z", "value": 10.2 },
          { "timestamp": "2025-01-15T09:35:00Z", "value": 12.1 }
        ]
      },
      "memory": {
        "current": 67.8,
        "average": 65.2,
        "peak": 82.1,
        "history": [
          { "timestamp": "2025-01-15T09:30:00Z", "value": 64.5 },
          { "timestamp": "2025-01-15T09:35:00Z", "value": 66.2 }
        ]
      }
    },
    "application": {
      "requestsPerSecond": 1247,
      "averageResponseTime": 245,
      "errorRate": 0.12,
      "activeConnections": 342
    },
    "nestshield": {
      "protection": {
        "requestsBlocked": 23,
        "requestsAllowed": 1224,
        "protectionRate": 98.2
      },
      "rateLimit": {
        "triggered": 15,
        "efficiency": 99.1
      },
      "circuitBreaker": {
        "triggered": 2,
        "efficiency": 99.8
      }
    }
  }
}
```

### Get Service Health Status

```http
GET /api/monitoring/services
```

**Response:**
```json
{
  "services": [
    {
      "name": "database",
      "status": "healthy",
      "responseTime": 15,
      "lastCheck": "2025-01-15T10:29:55Z",
      "uptime": 99.99,
      "details": {
        "connections": 8,
        "maxConnections": 100,
        "queryTime": 12
      }
    },
    {
      "name": "redis",
      "status": "healthy",
      "responseTime": 2,
      "lastCheck": "2025-01-15T10:29:55Z",
      "uptime": 99.95,
      "details": {
        "memoryUsage": 25.6,
        "connectedClients": 5,
        "commands": 15420
      }
    }
  ]
}
```

### Get Performance Metrics

```http
GET /api/monitoring/performance
```

**Query Parameters:**
- `metric` (optional): `response_time`, `throughput`, `error_rate`, `cpu`, `memory`
- `timeRange` (optional): `1h`, `6h`, `24h`, `7d`, `30d`

**Response:**
```json
{
  "metrics": {
    "responseTime": {
      "current": 245,
      "p50": 180,
      "p95": 350,
      "p99": 650,
      "history": [
        { "timestamp": "2025-01-15T09:30:00Z", "value": 220 },
        { "timestamp": "2025-01-15T09:35:00Z", "value": 245 }
      ]
    },
    "throughput": {
      "current": 1247,
      "average": 1150,
      "peak": 2100,
      "history": [
        { "timestamp": "2025-01-15T09:30:00Z", "value": 1100 },
        { "timestamp": "2025-01-15T09:35:00Z", "value": 1200 }
      ]
    }
  }
}
```

## Alert Management

### Get Alerts

```http
GET /api/monitoring/alerts
```

**Query Parameters:**
- `status` (optional): `active`, `resolved`, `all` (default: `active`)
- `severity` (optional): `low`, `medium`, `high`, `critical`
- `type` (optional): `performance`, `security`, `availability`, `anomaly`
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "alerts": [
    {
      "id": "alert_123456",
      "type": "performance",
      "severity": "high",
      "title": "High Response Time Detected",
      "message": "Average response time has exceeded 500ms for the last 5 minutes",
      "timestamp": "2025-01-15T10:25:00Z",
      "resolved": false,
      "resolvedAt": null,
      "metadata": {
        "metric": "response_time",
        "threshold": 500,
        "currentValue": 650,
        "duration": 300
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### Create Alert

```http
POST /api/monitoring/alerts
```

**Request Body:**
```json
{
  "type": "performance",
  "severity": "high",
  "title": "Custom Alert",
  "message": "Custom alert message",
  "metadata": {
    "source": "manual",
    "category": "testing"
  }
}
```

**Response:**
```json
{
  "id": "alert_789012",
  "type": "performance",
  "severity": "high",
  "title": "Custom Alert",
  "message": "Custom alert message",
  "timestamp": "2025-01-15T10:30:00Z",
  "resolved": false,
  "metadata": {
    "source": "manual",
    "category": "testing"
  }
}
```

### Resolve Alert

```http
PUT /api/monitoring/alerts/{id}/resolve
```

**Response:**
```json
{
  "message": "Alert resolved successfully",
  "alertId": "alert_123456",
  "resolvedAt": "2025-01-15T10:30:00Z"
}
```

## Configuration Management

### Get Configurations

```http
GET /api/configuration/{type}
```

**Path Parameters:**
- `type`: `rate-limits`, `circuit-breakers`, `throttles`, `anomaly-detection`, `global`

**Response for Rate Limits:**
```json
{
  "configurations": [
    {
      "id": "rl_123456",
      "name": "API Rate Limit",
      "path": "/api/*",
      "method": "ALL",
      "windowMs": 60000,
      "maxRequests": 100,
      "enabled": true,
      "createdAt": "2025-01-15T09:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### Create Configuration

```http
POST /api/configuration/{type}
```

**Request Body for Rate Limit:**
```json
{
  "name": "New API Rate Limit",
  "path": "/api/v2/*",
  "method": "POST",
  "windowMs": 300000,
  "maxRequests": 50,
  "enabled": true
}
```

**Response:**
```json
{
  "id": "rl_789012",
  "name": "New API Rate Limit",
  "path": "/api/v2/*",
  "method": "POST",
  "windowMs": 300000,
  "maxRequests": 50,
  "enabled": true,
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

### Update Configuration

```http
PUT /api/configuration/{type}/{id}
```

**Request Body:**
```json
{
  "maxRequests": 75,
  "enabled": true
}
```

**Response:**
```json
{
  "id": "rl_789012",
  "name": "New API Rate Limit",
  "path": "/api/v2/*",
  "method": "POST",
  "windowMs": 300000,
  "maxRequests": 75,
  "enabled": true,
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:35:00Z"
}
```

### Delete Configuration

```http
DELETE /api/configuration/{type}/{id}
```

**Response:**
```json
{
  "message": "Configuration deleted successfully",
  "id": "rl_789012"
}
```

### Export Configuration

```http
GET /api/configuration/export
```

**Response:**
```json
{
  "exportedAt": "2025-01-15T10:30:00Z",
  "version": "1.0.0",
  "configurations": {
    "rateLimits": [...],
    "circuitBreakers": [...],
    "throttles": [...],
    "anomalyDetection": [...],
    "global": {...}
  }
}
```

### Import Configuration

```http
POST /api/configuration/import
```

**Request Body:**
```json
{
  "configurations": {
    "rateLimits": [...],
    "circuitBreakers": [...]
  },
  "overwrite": false
}
```

**Response:**
```json
{
  "message": "Configuration imported successfully",
  "imported": {
    "rateLimits": 5,
    "circuitBreakers": 3,
    "throttles": 2,
    "anomalyDetection": 1
  },
  "skipped": {
    "rateLimits": 1
  }
}
```

## Analytics Endpoints

### Get Dashboard Data

```http
GET /api/monitoring/dashboard
```

**Response:**
```json
{
  "overview": {
    "requestsPerSecond": 1247,
    "averageResponseTime": 245,
    "errorRate": 0.12,
    "uptime": 99.9,
    "activeConnections": 342,
    "blockedRequests": 23
  },
  "protection": {
    "rateLimit": {
      "active": true,
      "triggered": 23,
      "efficiency": 98.2
    },
    "circuitBreaker": {
      "active": true,
      "triggered": 0,
      "efficiency": 100
    },
    "throttle": {
      "active": true,
      "triggered": 5,
      "efficiency": 99.4
    },
    "anomalyDetection": {
      "active": true,
      "detected": 2,
      "efficiency": 97.8
    }
  },
  "system": {
    "cpu": {
      "usage": 67,
      "cores": 8,
      "loadAverage": [1.2, 1.5, 1.8]
    },
    "memory": {
      "usage": 84,
      "total": 16,
      "used": 13.4,
      "available": 2.6
    },
    "network": {
      "bytesIn": 450,
      "bytesOut": 320,
      "connectionsActive": 142
    }
  }
}
```

### Get Real-time Metrics

```http
GET /api/monitoring/realtime
```

**Response:**
```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "systemMetrics": {
    "cpu": 15.5,
    "memory": 67.8,
    "network": {
      "bytesIn": 1024000,
      "bytesOut": 512000
    }
  },
  "serviceHealth": [
    {
      "service": "database",
      "status": "healthy",
      "responseTime": 15
    }
  ],
  "activeAlerts": 3,
  "performanceMetrics": {
    "requestsPerSecond": 1247,
    "averageResponseTime": 245,
    "errorRate": 0.12
  }
}
```

## Metrics Export

### Get Prometheus Metrics

```http
GET /api/metrics
```

**Response (Prometheus format):**
```
# HELP nestshield_requests_total Total number of requests
# TYPE nestshield_requests_total counter
nestshield_requests_total{method="GET",status="200"} 12470
nestshield_requests_total{method="POST",status="200"} 3250

# HELP nestshield_response_time_seconds Response time in seconds
# TYPE nestshield_response_time_seconds histogram
nestshield_response_time_seconds_bucket{le="0.1"} 8950
nestshield_response_time_seconds_bucket{le="0.5"} 15200
nestshield_response_time_seconds_bucket{le="1.0"} 15650
nestshield_response_time_seconds_bucket{le="+Inf"} 15720
```

### Get JSON Metrics

```http
GET /api/metrics/json
```

**Response:**
```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "metrics": {
    "requests_total": {
      "value": 15720,
      "labels": {
        "service": "nestshield-dashboard"
      }
    },
    "response_time_seconds": {
      "count": 15720,
      "sum": 3858.5,
      "buckets": {
        "0.1": 8950,
        "0.5": 15200,
        "1.0": 15650
      }
    }
  }
}
```

## WebSocket Integration

The REST API works alongside WebSocket connections for real-time updates. When configurations change via REST API, WebSocket events are automatically broadcasted.

### WebSocket Events Triggered by REST API

- `configurationChanged` - When configuration is created/updated/deleted
- `alertCreated` - When new alert is created
- `alertResolved` - When alert is resolved
- `metricsUpdated` - When metrics are updated

## SDK Usage Examples

### JavaScript/TypeScript SDK

```typescript
import { NestShieldDashboardClient } from '@usex/nest-shield-dashboard-sdk';

const client = new NestShieldDashboardClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Get metrics
const metrics = await client.monitoring.getMetrics({
  timeRange: '1h',
  granularity: '5m'
});

// Create rate limit
const rateLimit = await client.configuration.createRateLimit({
  name: 'API Rate Limit',
  path: '/api/*',
  maxRequests: 100,
  windowMs: 60000
});

// Get alerts
const alerts = await client.monitoring.getAlerts({
  status: 'active',
  severity: 'high'
});
```

### Python SDK

```python
from nestshield_dashboard import NestShieldDashboardClient

client = NestShieldDashboardClient(
    base_url='http://localhost:3000',
    api_key='your-api-key'
)

# Get metrics
metrics = client.monitoring.get_metrics(
    time_range='1h',
    granularity='5m'
)

# Create circuit breaker
circuit_breaker = client.configuration.create_circuit_breaker(
    name='Database Circuit Breaker',
    service='database',
    failure_threshold=5,
    recovery_timeout=30000
)
```

### cURL Examples

```bash
# Get system metrics
curl -X GET "http://localhost:3000/api/monitoring/metrics?timeRange=1h" \
  -H "Accept: application/json" \
  -H "Cookie: next-auth.session-token=your-session-token"

# Create rate limit configuration
curl -X POST "http://localhost:3000/api/configuration/rate-limits" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=your-session-token" \
  -d '{
    "name": "API Rate Limit",
    "path": "/api/*",
    "method": "ALL",
    "windowMs": 60000,
    "maxRequests": 100,
    "enabled": true
  }'

# Resolve alert
curl -X PUT "http://localhost:3000/api/monitoring/alerts/alert_123456/resolve" \
  -H "Cookie: next-auth.session-token=your-session-token"
```

## API Versioning

The API uses URL versioning for major changes:

- `v1` (current): `/api/...`
- `v2` (future): `/api/v2/...`

Minor updates maintain backward compatibility within the same version.

## Deprecation Policy

- **Deprecation Notice**: 6 months before removal
- **Breaking Changes**: Only in major versions
- **Sunset Headers**: `Sunset` header indicates deprecation date

## Next Steps

- [WebSocket API](./websocket.md) - Real-time communication
- [GraphQL Schema](./graphql.md) - Alternative query interface
- [Examples](../examples/) - Practical API usage examples
- [SDK Documentation](./sdk.md) - Client library documentation

---

**API Reference complete!** You now have comprehensive documentation for all REST API endpoints.