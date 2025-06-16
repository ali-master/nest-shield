# Common Issues & Solutions

This guide covers the most common issues you might encounter when using the NestShield Dashboard and their solutions.

## Installation Issues

### Node.js Version Compatibility

**Problem:** Getting errors related to Node.js version compatibility.

**Symptoms:**
```bash
ERR_OSSL_EVP_UNSUPPORTED
node: --openssl-legacy-provider is not allowed in NODE_OPTIONS
```

**Solution:**
```bash
# Check your Node.js version
node --version

# NestShield Dashboard requires Node.js 18+
# Install/update Node.js
nvm install 18
nvm use 18

# Or with direct installation
# Visit https://nodejs.org for the latest LTS version
```

### Package Installation Failures

**Problem:** npm/yarn/pnpm installation fails with dependency conflicts.

**Symptoms:**
```bash
ERROR: Unable to resolve dependency tree
Peer dependency warnings
EEXIST: file already exists
```

**Solutions:**

1. **Clear cache and reinstall:**
   ```bash
   # For npm
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install

   # For yarn
   yarn cache clean
   rm -rf node_modules yarn.lock
   yarn install

   # For pnpm
   pnpm store prune
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

2. **Use legacy peer deps:**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Force installation:**
   ```bash
   npm install --force
   ```

### Docker Build Issues

**Problem:** Docker build fails or containers won't start.

**Symptoms:**
```bash
ERROR: failed to solve: process "/bin/sh -c npm ci" did not complete
Container exits immediately
Port already in use
```

**Solutions:**

1. **Check Docker version:**
   ```bash
   docker --version
   # Ensure Docker 20.10+ and Docker Compose 2.0+
   ```

2. **Clean Docker cache:**
   ```bash
   docker system prune -a
   docker volume prune
   ```

3. **Fix port conflicts:**
   ```bash
   # Check what's using the port
   lsof -i :3000
   
   # Kill the process or change port in docker-compose.yml
   ports:
     - "3001:3000"
   ```

4. **Rebuild containers:**
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

## Database Connection Issues

### MariaDB/MySQL Connection Refused

**Problem:** Cannot connect to the database.

**Symptoms:**
```
ERROR 2002 (HY000): Can't connect to MySQL server
Connection refused
Access denied for user
```

**Solutions:**

1. **Check database service:**
   ```bash
   # Check if MariaDB is running
   sudo systemctl status mariadb
   # Or for MySQL
   sudo systemctl status mysql
   
   # Start the service if stopped
   sudo systemctl start mariadb
   ```

2. **Verify connection parameters:**
   ```bash
   # Test connection manually
   mysql -h localhost -P 3306 -u nestshield -p
   
   # Check environment variables
   echo $DB_HOST
   echo $DB_PORT
   echo $DB_USER
   ```

3. **Check firewall:**
   ```bash
   # Allow MySQL port through firewall
   sudo ufw allow 3306
   ```

4. **Verify user permissions:**
   ```sql
   -- Connect as root and check user
   SELECT User, Host FROM mysql.user WHERE User = 'nestshield';
   
   -- Grant permissions if needed
   GRANT ALL PRIVILEGES ON nestshield_dashboard.* TO 'nestshield'@'localhost';
   FLUSH PRIVILEGES;
   ```

### Database Schema Issues

**Problem:** Database migrations fail or schema is outdated.

**Symptoms:**
```
Table 'nestshield_dashboard.configurations' doesn't exist
Migration failed
Column doesn't exist
```

**Solutions:**

1. **Run migrations:**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

2. **Reset database (development only):**
   ```bash
   # Drop and recreate database
   mysql -u root -p
   DROP DATABASE nestshield_dashboard;
   CREATE DATABASE nestshield_dashboard;
   
   # Run migrations again
   npm run db:migrate
   ```

3. **Check migration files:**
   ```bash
   ls -la drizzle/
   # Ensure migration files exist
   ```

## Redis Connection Issues

### Redis Connection Timeout

**Problem:** Cannot connect to Redis server.

**Symptoms:**
```
Redis connection timeout
ECONNREFUSED 127.0.0.1:6379
Redis server is not ready
```

**Solutions:**

1. **Check Redis service:**
   ```bash
   # Check if Redis is running
   redis-cli ping
   # Should return PONG
   
   # Start Redis if not running
   sudo systemctl start redis
   # Or with Docker
   docker run -d --name redis -p 6379:6379 redis:alpine
   ```

2. **Check Redis configuration:**
   ```bash
   # Check Redis config
   redis-cli CONFIG GET bind
   redis-cli CONFIG GET port
   
   # Check if auth is required
   redis-cli CONFIG GET requirepass
   ```

3. **Test connection with auth:**
   ```bash
   redis-cli -a your_password ping
   ```

### Redis Memory Issues

**Problem:** Redis runs out of memory.

**Symptoms:**
```
OOM command not allowed when used memory > 'maxmemory'
Redis is running out of memory
```

**Solutions:**

1. **Increase Redis memory limit:**
   ```bash
   # Edit Redis config
   sudo vim /etc/redis/redis.conf
   
   # Increase maxmemory
   maxmemory 512mb
   
   # Set eviction policy
   maxmemory-policy allkeys-lru
   
   # Restart Redis
   sudo systemctl restart redis
   ```

2. **Clear Redis cache:**
   ```bash
   redis-cli FLUSHALL
   ```

## Application Runtime Issues

### High Memory Usage

**Problem:** Dashboard consumes too much memory.

**Symptoms:**
```
Out of memory errors
Slow response times
Frequent garbage collection
```

**Solutions:**

1. **Increase Node.js memory limit:**
   ```bash
   # Set memory limit to 4GB
   export NODE_OPTIONS="--max-old-space-size=4096"
   npm start
   
   # Or in package.json
   "start": "NODE_OPTIONS='--max-old-space-size=4096' next start"
   ```

2. **Optimize metrics collection:**
   ```javascript
   // Reduce metrics history size
   METRICS_RETENTION_DAYS=7
   METRICS_INTERVAL=10000
   ```

3. **Enable garbage collection monitoring:**
   ```bash
   NODE_OPTIONS="--expose-gc --trace-gc" npm start
   ```

### Slow Performance

**Problem:** Dashboard loads slowly or responds slowly.

**Symptoms:**
```
Long page load times
Slow API responses
WebSocket disconnections
```

**Solutions:**

1. **Enable compression:**
   ```javascript
   // In next.config.js
   module.exports = {
     compress: true,
     // Other optimizations
   }
   ```

2. **Optimize database queries:**
   ```sql
   -- Add indexes for frequently queried columns
   CREATE INDEX idx_metrics_timestamp ON metrics(timestamp);
   CREATE INDEX idx_alerts_status ON alerts(status);
   ```

3. **Configure Redis caching:**
   ```javascript
   // Increase cache TTL
   CACHE_TTL=600
   REDIS_TTL=3600
   ```

4. **Enable CDN for static assets:**
   ```javascript
   // In next.config.js
   module.exports = {
     assetPrefix: 'https://cdn.yourdomain.com',
   }
   ```

## WebSocket Connection Issues

### WebSocket Connection Drops

**Problem:** Real-time updates stop working.

**Symptoms:**
```
WebSocket disconnected
No real-time updates
Connection timeouts
```

**Solutions:**

1. **Check WebSocket URL:**
   ```javascript
   // Ensure correct WebSocket URL in environment
   NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3001
   // Or for production
   NEXT_PUBLIC_WEBSOCKET_URL=wss://api.yourdomain.com
   ```

2. **Configure reconnection:**
   ```javascript
   // Increase reconnection attempts
   WEBSOCKET_RECONNECT_ATTEMPTS=10
   WEBSOCKET_RECONNECT_DELAY=5000
   ```

3. **Check proxy configuration:**
   ```nginx
   # In nginx.conf
   location /socket.io/ {
       proxy_pass http://backend;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
   }
   ```

### WebSocket CORS Issues

**Problem:** WebSocket connections blocked by CORS.

**Symptoms:**
```
CORS policy error
WebSocket handshake failed
Access denied
```

**Solutions:**

1. **Configure CORS in NestShield Core:**
   ```typescript
   // In main.ts
   app.enableCors({
     origin: ['http://localhost:3000', 'https://yourdomain.com'],
     credentials: true,
   });
   ```

2. **Update WebSocket CORS:**
   ```typescript
   // In gateway
   @WebSocketGateway({
     cors: {
       origin: ['http://localhost:3000'],
       credentials: true,
     },
   })
   ```

## API Integration Issues

### API Authentication Failures

**Problem:** API calls return 401 Unauthorized.

**Symptoms:**
```
401 Unauthorized
Invalid session
Expired token
```

**Solutions:**

1. **Check session configuration:**
   ```javascript
   // Verify NextAuth configuration
   NEXTAUTH_SECRET=your_secret_key
   NEXTAUTH_URL=http://localhost:3000
   ```

2. **Clear browser cookies:**
   ```bash
   # Clear application data in browser dev tools
   # Or programmatically
   document.cookie.split(";").forEach(c => {
     document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
   });
   ```

3. **Verify API endpoints:**
   ```bash
   # Test API directly
   curl -H "Cookie: session-token=your-token" http://localhost:3000/api/health
   ```

### API Rate Limiting

**Problem:** API calls return 429 Too Many Requests.

**Symptoms:**
```
429 Too Many Requests
Rate limit exceeded
Quota exceeded
```

**Solutions:**

1. **Increase rate limits:**
   ```javascript
   // In environment
   RATE_LIMIT_MAX_REQUESTS=200
   RATE_LIMIT_WINDOW_MS=900000
   ```

2. **Implement request throttling:**
   ```javascript
   // Use debouncing for frequent requests
   const debouncedRequest = debounce(apiCall, 300);
   ```

3. **Add retry logic:**
   ```javascript
   const retryRequest = async (fn, retries = 3) => {
     try {
       return await fn();
     } catch (error) {
       if (error.status === 429 && retries > 0) {
         await new Promise(resolve => setTimeout(resolve, 1000));
         return retryRequest(fn, retries - 1);
       }
       throw error;
     }
   };
   ```

## Build and Deployment Issues

### Build Failures

**Problem:** npm run build fails.

**Symptoms:**
```
TypeScript compilation errors
ESLint errors
Out of memory during build
```

**Solutions:**

1. **Fix TypeScript errors:**
   ```bash
   # Check types
   npm run check-types
   
   # Fix common issues
   npm run lint:fix
   ```

2. **Increase build memory:**
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm run build
   ```

3. **Skip type checking (temporary):**
   ```javascript
   // In next.config.js
   module.exports = {
     typescript: {
       ignoreBuildErrors: true,
     },
   }
   ```

### Production Deployment Issues

**Problem:** Application doesn't work in production.

**Symptoms:**
```
Blank page in production
Assets not loading
API endpoints not accessible
```

**Solutions:**

1. **Check environment variables:**
   ```bash
   # Verify production environment
   echo $NODE_ENV
   echo $NEXT_PUBLIC_API_URL
   ```

2. **Configure reverse proxy:**
   ```nginx
   # nginx.conf
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

3. **Check SSL configuration:**
   ```bash
   # Verify SSL certificate
   openssl s_client -connect yourdomain.com:443
   ```

## Monitoring and Debugging

### Enable Debug Logging

```bash
# Enable all debug logs
DEBUG=* npm start

# Enable specific modules
DEBUG=nestshield:* npm start

# Enable verbose logging
VERBOSE_LOGGING=true npm start
```

### Health Check Endpoints

```bash
# Check application health
curl http://localhost:3000/api/health

# Detailed health check
curl http://localhost:3000/api/health/detailed

# Check specific services
curl http://localhost:3000/api/monitoring/services
```

### Performance Monitoring

```bash
# Monitor memory usage
node --trace-gc app.js

# Profile CPU usage
node --prof app.js

# Monitor event loop lag
DEBUG=* node --trace-warnings app.js
```

## Getting Additional Help

### Log Collection

When reporting issues, please include:

1. **Application logs:**
   ```bash
   # Collect logs with timestamps
   npm start 2>&1 | tee application.log
   ```

2. **System information:**
   ```bash
   node --version
   npm --version
   docker --version
   cat /etc/os-release
   ```

3. **Environment configuration:**
   ```bash
   # Remove sensitive data before sharing
   env | grep -E '(NODE_|DB_|REDIS_|API_)' | sed 's/=.*/=***REDACTED***/'
   ```

### Community Support

- **GitHub Issues**: [Report bugs and feature requests](https://github.com/ali-master/nest-shield/issues)
- **Discussions**: [Community discussions](https://github.com/ali-master/nest-shield/discussions)
- **Stack Overflow**: Tag your questions with `nestshield`
- **Discord**: Join our community server

### Professional Support

For enterprise support and custom solutions:
- **Email**: support@usestrict.dev
- **Website**: [Professional Support](https://usestrict.dev/support)

---

**Troubleshooting complete!** If you're still experiencing issues, please check our [FAQ](./faq.md) or reach out to the community for help.