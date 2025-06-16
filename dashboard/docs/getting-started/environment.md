# Environment Setup

This guide covers the detailed configuration of your NestShield Dashboard environment for optimal performance and security.

## Environment Files

The dashboard uses different environment files for different deployment stages:

- `.env.development` - Development environment
- `.env.production` - Production environment
- `.env.test` - Testing environment
- `.env.local` - Local overrides (not committed to git)

## Environment Variables Reference

### Database Configuration

```bash
# Database Connection
DB_HOST=localhost                    # Database host
DB_PORT=3306                        # Database port
DB_USER=nestshield                  # Database username
DB_PASSWORD=your_secure_password    # Database password
DB_NAME=nestshield_dashboard        # Database name
DB_SSL=false                        # Enable SSL connection
DB_CONNECTION_LIMIT=10              # Connection pool limit
DB_TIMEOUT=30000                    # Connection timeout (ms)

# Database URLs (alternative to individual settings)
DATABASE_URL=mysql://nestshield:password@localhost:3306/nestshield_dashboard
```

### Redis Configuration

```bash
# Redis Connection
REDIS_HOST=localhost                # Redis host
REDIS_PORT=6379                     # Redis port
REDIS_PASSWORD=your_redis_password  # Redis password (optional)
REDIS_DB=0                          # Redis database number
REDIS_PREFIX=nestshield:            # Key prefix
REDIS_TTL=3600                      # Default TTL in seconds

# Redis URL (alternative to individual settings)
REDIS_URL=redis://username:password@localhost:6379/0

# Redis Cluster (for high availability)
REDIS_CLUSTER_NODES=localhost:7000,localhost:7001,localhost:7002
REDIS_CLUSTER_PASSWORD=cluster_password
```

### API Configuration

```bash
# NestShield Core API
API_BASE_URL=http://localhost:3001          # Internal API URL
NEXT_PUBLIC_API_URL=http://localhost:3001   # Public API URL (browser)
API_TIMEOUT=30000                           # API request timeout (ms)
API_RETRY_ATTEMPTS=3                        # Number of retry attempts
API_RETRY_DELAY=1000                        # Delay between retries (ms)

# WebSocket Configuration
WEBSOCKET_URL=ws://localhost:3001           # WebSocket server URL
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3001 # Public WebSocket URL
WEBSOCKET_RECONNECT_ATTEMPTS=5              # Reconnection attempts
WEBSOCKET_RECONNECT_DELAY=3000              # Reconnection delay (ms)
```

### Security Configuration

```bash
# NextAuth.js Configuration
NEXTAUTH_SECRET=your_nextauth_secret_key_min_32_chars
NEXTAUTH_URL=http://localhost:3000

# Session Configuration
SESSION_STRATEGY=jwt                        # 'jwt' or 'database'
SESSION_MAX_AGE=86400                       # Session duration (seconds)
JWT_SECRET=your_jwt_secret_key              # JWT signing secret

# CSRF Protection
CSRF_SECRET=your_csrf_secret_key            # CSRF token secret
CSRF_COOKIE_NAME=csrf-token                 # CSRF cookie name

# CORS Configuration
CORS_ORIGIN=http://localhost:3000           # Allowed origins
CORS_CREDENTIALS=true                       # Allow credentials
```

### Feature Flags

```bash
# Core Features
ENABLE_MONITORING=true                      # Enable monitoring features
ENABLE_WEBSOCKET=true                       # Enable WebSocket communication
ENABLE_METRICS=true                         # Enable metrics collection
ENABLE_ALERTS=true                          # Enable alerting system
ENABLE_CONFIGURATION=true                   # Enable configuration management

# Advanced Features
ENABLE_SECURITY_SCANNER=true               # Enable security scanning
ENABLE_PERFORMANCE_OPTIMIZER=true          # Enable performance optimization
ENABLE_LOAD_TESTER=true                    # Enable load testing
ENABLE_REPORT_GENERATOR=true               # Enable report generation
ENABLE_DATA_EXPORT=true                    # Enable data export
ENABLE_API_PLAYGROUND=true                 # Enable API playground
ENABLE_WEBHOOK_MANAGER=true                # Enable webhook management
ENABLE_CUSTOM_DASHBOARD=true               # Enable custom dashboards
ENABLE_ANOMALY_DETECTION=true              # Enable anomaly detection
ENABLE_PREDICTIVE_SCALING=true             # Enable predictive scaling

# UI Features
ENABLE_DARK_MODE=true                      # Enable dark mode toggle
ENABLE_THEME_CUSTOMIZATION=true            # Enable theme customization
ENABLE_LAYOUT_CUSTOMIZATION=true           # Enable layout customization
```

### Internationalization

```bash
# i18n Configuration
NEXT_LOCALE=en                              # Default locale
NEXT_LOCALES=en,fa,es,fr,de,ja,zh          # Supported locales
NEXT_DEFAULT_LOCALE=en                      # Fallback locale
I18N_CACHE_TTL=3600                        # Translation cache TTL
```

### Logging Configuration

```bash
# Logging Settings
LOG_LEVEL=info                              # Log level (error, warn, info, debug)
LOG_FORMAT=json                             # Log format (json, text)
LOG_FILE_PATH=/var/log/nestshield-dashboard.log
LOG_MAX_FILES=10                            # Maximum log files to keep
LOG_MAX_SIZE=10m                            # Maximum log file size

# External Logging
SENTRY_DSN=https://your-sentry-dsn         # Sentry error tracking
SENTRY_ENVIRONMENT=development              # Sentry environment
SENTRY_RELEASE=1.0.0                       # Release version
```

### Performance Configuration

```bash
# Caching
CACHE_TTL=300                               # Default cache TTL (seconds)
CACHE_MAX_SIZE=100                          # Maximum cache entries
CACHE_STRATEGY=lru                          # Cache eviction strategy

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000                 # Rate limit window (15 min)
RATE_LIMIT_MAX_REQUESTS=100                 # Max requests per window
RATE_LIMIT_SKIP_FAILED_REQUESTS=true       # Skip failed requests

# Compression
COMPRESSION_ENABLED=true                    # Enable response compression
COMPRESSION_LEVEL=6                         # Compression level (1-9)
COMPRESSION_THRESHOLD=1024                  # Minimum size to compress
```

### Monitoring Configuration

```bash
# Health Checks
HEALTH_CHECK_INTERVAL=30000                 # Health check interval (ms)
HEALTH_CHECK_TIMEOUT=5000                   # Health check timeout (ms)
HEALTH_CHECK_ENABLED=true                   # Enable health checks

# Metrics Collection
METRICS_INTERVAL=5000                       # Metrics collection interval (ms)
METRICS_RETENTION_DAYS=30                   # Metrics retention period
METRICS_EXPORT_FORMAT=prometheus            # Metrics export format

# Alerting
ALERT_WEBHOOK_URL=https://hooks.slack.com/your-webhook
ALERT_EMAIL_FROM=alerts@yourcompany.com
ALERT_EMAIL_SMTP_HOST=smtp.yourcompany.com
ALERT_EMAIL_SMTP_PORT=587
ALERT_EMAIL_SMTP_USER=alerts@yourcompany.com
ALERT_EMAIL_SMTP_PASS=your_smtp_password
```

## Environment-Specific Configurations

### Development Environment

```bash
# .env.development
NODE_ENV=development
NEXT_PUBLIC_APP_ENV=development

# Enable debugging
DEBUG=nestshield:*
VERBOSE_LOGGING=true

# Relaxed security for development
CSRF_ENABLED=false
HTTPS_REQUIRED=false

# Development-specific URLs
API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
WEBSOCKET_URL=ws://localhost:3001
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3001

# Hot reloading
FAST_REFRESH=true
WATCH_POLL=true
```

### Production Environment

```bash
# .env.production
NODE_ENV=production
NEXT_PUBLIC_APP_ENV=production

# Security hardening
CSRF_ENABLED=true
HTTPS_REQUIRED=true
SECURE_COOKIES=true
SAME_SITE_COOKIES=strict

# Production URLs (use your actual domains)
API_BASE_URL=https://api.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
WEBSOCKET_URL=wss://api.yourdomain.com
NEXT_PUBLIC_WEBSOCKET_URL=wss://api.yourdomain.com
NEXTAUTH_URL=https://dashboard.yourdomain.com

# Performance optimization
COMPRESSION_ENABLED=true
CACHE_TTL=3600
STATIC_CACHE_MAX_AGE=31536000

# Production database with SSL
DB_SSL=true
DB_SSL_CA=/path/to/ca-cert.pem
DB_SSL_CERT=/path/to/client-cert.pem
DB_SSL_KEY=/path/to/client-key.pem

# Redis with authentication
REDIS_PASSWORD=your_strong_redis_password
REDIS_TLS=true
```

### Testing Environment

```bash
# .env.test
NODE_ENV=test
NEXT_PUBLIC_APP_ENV=test

# Test database
DB_NAME=nestshield_dashboard_test
DB_HOST=localhost
DB_PORT=3306

# Test Redis
REDIS_DB=1
REDIS_PREFIX=test:nestshield:

# Disable external services
ENABLE_WEBSOCKET=false
ENABLE_METRICS=false
ENABLE_ALERTS=false

# Test-specific settings
TEST_TIMEOUT=30000
TEST_PARALLEL=true
TEST_COVERAGE=true
```

## Security Best Practices

### Secrets Management

1. **Never commit secrets to git**:
   ```bash
   # Add to .gitignore
   .env.local
   .env*.local
   *.key
   *.pem
   ```

2. **Use strong, unique secrets**:
   ```bash
   # Generate secure secrets
   openssl rand -hex 32  # For NEXTAUTH_SECRET
   openssl rand -base64 32  # For JWT_SECRET
   ```

3. **Use environment-specific secrets**:
   - Development: Simple secrets for local development
   - Staging: Production-like secrets for testing
   - Production: Strong, rotated secrets

### Environment Validation

Create a validation script to check environment variables:

```javascript
// scripts/validate-env.js
const requiredEnvVars = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'REDIS_HOST',
  'API_BASE_URL',
  'NEXTAUTH_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:');
  missingVars.forEach(varName => console.error(`  - ${varName}`));
  process.exit(1);
}

console.log('Environment validation passed!');
```

Run validation:

```bash
node scripts/validate-env.js
```

## Docker Environment

### Docker Compose Environment

```yaml
# docker-compose.yml
version: '3.8'

services:
  dashboard:
    image: usex/nest-shield-dashboard
    env_file:
      - .env.production
    environment:
      - NODE_ENV=production
      - DB_HOST=database
      - REDIS_HOST=redis
    ports:
      - "3000:3000"
```

### Kubernetes Environment

```yaml
# k8s-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nestshield-dashboard-config
data:
  NODE_ENV: production
  ENABLE_MONITORING: "true"
  ENABLE_WEBSOCKET: "true"
---
apiVersion: v1
kind: Secret
metadata:
  name: nestshield-dashboard-secrets
type: Opaque
stringData:
  DB_PASSWORD: your_db_password
  REDIS_PASSWORD: your_redis_password
  NEXTAUTH_SECRET: your_nextauth_secret
```

## Environment Troubleshooting

### Common Issues

1. **Environment variables not loading**:
   ```bash
   # Check if .env file exists
   ls -la .env*
   
   # Check file permissions
   chmod 600 .env.development
   ```

2. **Database connection issues**:
   ```bash
   # Test database connection
   mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME
   ```

3. **Redis connection issues**:
   ```bash
   # Test Redis connection
   redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD ping
   ```

### Environment Debugging

Add debug logging to check environment loading:

```javascript
// Add to next.config.js
console.log('Environment variables loaded:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('REDIS_HOST:', process.env.REDIS_HOST);
console.log('API_BASE_URL:', process.env.API_BASE_URL);
```

## Next Steps

After configuring your environment:

1. [First Dashboard](./first-dashboard.md) - Create your first monitoring dashboard
2. [Architecture Overview](./architecture.md) - Understand the system architecture
3. [Database Configuration](../configuration/database.md) - Advanced database setup
4. [Redis Configuration](../configuration/redis.md) - Advanced Redis setup

---

**Environment configuration complete!** Your NestShield Dashboard is now properly configured for your deployment environment.