# Installation Guide

This guide will help you install and set up the NestShield Dashboard for monitoring and managing your NestShield protection systems.

## Prerequisites

Before installing the NestShield Dashboard, ensure you have the following prerequisites:

### System Requirements
- **Node.js**: Version 18.0 or higher
- **npm/yarn/pnpm**: Latest stable version
- **Database**: MariaDB 10.5+ or MySQL 8.0+
- **Redis**: Version 6.0 or higher
- **Memory**: Minimum 2GB RAM
- **Storage**: At least 1GB free space

### NestShield Core
The dashboard requires a running NestShield Core API. Install and configure the core library first:

```bash
npm install @usex/nest-shield
```

Refer to the [NestShield Core Documentation](../../README.md) for core setup instructions.

## Installation Methods

### Method 1: NPM Package (Recommended)

```bash
# Install the dashboard package
npm install @usex/nest-shield-dashboard

# Or with yarn
yarn add @usex/nest-shield-dashboard

# Or with pnpm
pnpm add @usex/nest-shield-dashboard
```

### Method 2: Clone from Source

```bash
# Clone the repository
git clone https://github.com/ali-master/nest-shield.git
cd nest-shield/dashboard

# Install dependencies
npm install
```

### Method 3: Docker Installation

```bash
# Pull the official image
docker pull usex/nest-shield-dashboard

# Or build from source
git clone https://github.com/ali-master/nest-shield.git
cd nest-shield/dashboard
docker build -t nest-shield-dashboard .
```

## Quick Setup

### 1. Environment Configuration

Create your environment file:

```bash
# Copy the example environment file
cp .env.example .env.development
```

Edit `.env.development` with your configuration:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=nestshield
DB_PASSWORD=your_secure_password
DB_NAME=nestshield_dashboard

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# API Configuration
API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001

# Security
NEXTAUTH_SECRET=your_nextauth_secret_key
NEXTAUTH_URL=http://localhost:3000

# Features
ENABLE_MONITORING=true
ENABLE_WEBSOCKET=true
ENABLE_METRICS=true
```

### 2. Database Setup

#### MariaDB/MySQL Setup

```sql
-- Create database and user
CREATE DATABASE nestshield_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nestshield'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON nestshield_dashboard.* TO 'nestshield'@'localhost';
FLUSH PRIVILEGES;
```

#### Run Database Migrations

```bash
# Generate and run migrations
npm run db:generate
npm run db:migrate
```

### 3. Redis Setup

#### Install Redis

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Docker:**
```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

#### Configure Redis (Optional)

Edit `/etc/redis/redis.conf` for production:

```conf
# Security
requirepass your_redis_password

# Performance
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000
```

### 4. Start the Dashboard

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm run start
```

The dashboard will be available at `http://localhost:3000`.

## Docker Installation

### Using Docker Compose (Recommended)

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  dashboard:
    image: usex/nest-shield-dashboard
    ports:
      - "3000:3000"
    environment:
      - DB_HOST=database
      - DB_USER=nestshield
      - DB_PASSWORD=secure_password
      - DB_NAME=nestshield_dashboard
      - REDIS_HOST=redis
      - API_BASE_URL=http://nestshield-api:3001
    depends_on:
      - database
      - redis
      - nestshield-api
    networks:
      - nestshield-network

  database:
    image: mariadb:10.11
    environment:
      - MYSQL_ROOT_PASSWORD=root_password
      - MYSQL_DATABASE=nestshield_dashboard
      - MYSQL_USER=nestshield
      - MYSQL_PASSWORD=secure_password
    volumes:
      - db_data:/var/lib/mysql
    networks:
      - nestshield-network

  redis:
    image: redis:alpine
    command: redis-server --requirepass redis_password
    volumes:
      - redis_data:/data
    networks:
      - nestshield-network

  nestshield-api:
    image: usex/nest-shield-api
    ports:
      - "3001:3001"
    environment:
      - DB_HOST=database
      - REDIS_HOST=redis
    depends_on:
      - database
      - redis
    networks:
      - nestshield-network

volumes:
  db_data:
  redis_data:

networks:
  nestshield-network:
    driver: bridge
```

Start the stack:

```bash
docker-compose up -d
```

### Manual Docker Installation

```bash
# Run MariaDB
docker run -d --name nestshield-db \
  -e MYSQL_ROOT_PASSWORD=root_password \
  -e MYSQL_DATABASE=nestshield_dashboard \
  -e MYSQL_USER=nestshield \
  -e MYSQL_PASSWORD=secure_password \
  -p 3306:3306 \
  mariadb:10.11

# Run Redis
docker run -d --name nestshield-redis \
  -p 6379:6379 \
  redis:alpine redis-server --requirepass redis_password

# Run Dashboard
docker run -d --name nestshield-dashboard \
  -p 3000:3000 \
  -e DB_HOST=host.docker.internal \
  -e DB_USER=nestshield \
  -e DB_PASSWORD=secure_password \
  -e DB_NAME=nestshield_dashboard \
  -e REDIS_HOST=host.docker.internal \
  -e REDIS_PASSWORD=redis_password \
  usex/nest-shield-dashboard
```

## Verification

### Health Checks

Verify the installation by checking the health endpoints:

```bash
# Application health
curl http://localhost:3000/api/health

# Detailed health with dependencies
curl http://localhost:3000/api/health/detailed

# Metrics endpoint
curl http://localhost:3000/api/metrics
```

### Dashboard Access

1. Open your browser and navigate to `http://localhost:3000`
2. You should see the NestShield Dashboard login page
3. Use the default credentials or your configured authentication method
4. Verify that real-time metrics are displayed

### WebSocket Connection

Check the browser's developer console for WebSocket connection messages:

```javascript
// Should see messages like:
// "WebSocket connected to monitoring namespace"
// "Receiving real-time metrics"
```

## Troubleshooting Installation

### Common Issues

#### Database Connection Issues

```bash
# Test database connection
mysql -h localhost -u nestshield -p nestshield_dashboard

# Check if database exists
SHOW DATABASES;
```

#### Redis Connection Issues

```bash
# Test Redis connection
redis-cli ping

# Test with authentication
redis-cli -a your_redis_password ping
```

#### Port Conflicts

```bash
# Check if ports are in use
lsof -i :3000  # Dashboard port
lsof -i :3306  # Database port
lsof -i :6379  # Redis port
```

#### Permission Issues

```bash
# Fix file permissions
chmod -R 755 /path/to/nestshield/dashboard
chown -R $USER:$USER /path/to/nestshield/dashboard
```

### Getting Help

If you encounter issues during installation:

1. Check the [Troubleshooting Guide](../troubleshooting/common-issues.md)
2. Review the [FAQ](../troubleshooting/faq.md)
3. Search existing [GitHub Issues](https://github.com/ali-master/nest-shield/issues)
4. Create a new issue with detailed error information

## Next Steps

After successful installation:

1. [Environment Setup](./environment.md) - Configure your environment properly
2. [First Dashboard](./first-dashboard.md) - Create your first monitoring dashboard
3. [Architecture Overview](./architecture.md) - Understand the system architecture
4. [Configuration Guide](../configuration/) - Advanced configuration options

---

**Installation complete!** You're now ready to monitor and manage your NestShield protection systems.