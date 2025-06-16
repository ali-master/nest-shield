# NestShield Dashboard - Docker Setup

This document provides comprehensive instructions for running the NestShield Dashboard using Docker in both development and production environments.

## Quick Start

### Development Environment

```bash
# Clone and navigate to the dashboard directory
cd nest-shield/dashboard

# Start development environment
./scripts/docker-dev.sh start

# Or with playground included
./scripts/docker-dev.sh start with-playground
```

### Production Environment

```bash
# Setup production environment
cp .env.example .env.production
# Edit .env.production with your values

# Create secrets
mkdir secrets
echo "your-mysql-root-password" > secrets/mysql_root_password.txt
echo "your-mysql-password" > secrets/mysql_password.txt
echo "your-nextauth-secret" > secrets/nextauth_secret.txt

# Deploy to production
./scripts/docker-prod.sh deploy
```

## Development Setup

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM available for containers

### Development Services

The development environment includes:

- **Dashboard** (port 3001) - Next.js development server with hot reload
- **MySQL** (port 3306) - Database with development data
- **Redis** (port 6379) - Caching and session storage
- **Adminer** (port 8080) - Database management UI
- **Redis Commander** (port 8081) - Redis management UI
- **MailHog** (port 8025) - Email testing tool
- **Playground** (port 3000, optional) - NestShield API playground

### Development Commands

```bash
# Start environment
./scripts/docker-dev.sh start

# Start with playground
./scripts/docker-dev.sh start with-playground

# Stop environment
./scripts/docker-dev.sh stop

# View logs
./scripts/docker-dev.sh logs dashboard

# Execute commands in containers
./scripts/docker-dev.sh exec dashboard pnpm run build

# Database operations
./scripts/docker-dev.sh db migrate
./scripts/docker-dev.sh db seed
./scripts/docker-dev.sh db shell

# Clean up
./scripts/docker-dev.sh clean
./scripts/docker-dev.sh clean --all  # Remove data too
```

### Development URLs

- Dashboard: http://localhost:3001
- Playground: http://localhost:3000 (if enabled)
- Adminer: http://localhost:8080
- Redis Commander: http://localhost:8081 (admin/admin)
- MailHog: http://localhost:8025

### Hot Reloading

The development setup supports hot reloading:
- Source code changes trigger automatic rebuilds
- Database schema changes can be applied with migrations
- Environment variable changes require container restart

## Production Setup

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Minimum 8GB RAM
- SSL certificates (Let's Encrypt supported)
- Domain names configured

### Production Architecture

The production environment includes:

- **Dashboard** (load balanced, 2 replicas)
- **MySQL** (persistent data, optimized configuration)
- **Redis** (persistent cache, production settings)
- **Traefik** (reverse proxy, SSL termination)
- **Prometheus** (metrics collection)
- **Grafana** (monitoring dashboards)
- **Loki + Promtail** (log aggregation)

### Production Deployment

1. **Environment Setup**
   ```bash
   # Copy and edit environment file
   cp .env.example .env.production
   vim .env.production
   ```

2. **Secrets Management**
   ```bash
   mkdir secrets
   echo "strong-mysql-root-password" > secrets/mysql_root_password.txt
   echo "mysql-user-password" > secrets/mysql_password.txt
   echo "nextauth-secret-32-chars-min" > secrets/nextauth_secret.txt
   chmod 600 secrets/*
   ```

3. **Deploy**
   ```bash
   ./scripts/docker-prod.sh deploy
   ```

### Production Commands

```bash
# Deploy/Update
./scripts/docker-prod.sh deploy
./scripts/docker-prod.sh update

# Management
./scripts/docker-prod.sh status
./scripts/docker-prod.sh health
./scripts/docker-prod.sh logs dashboard 200

# Scaling
./scripts/docker-prod.sh scale dashboard 3

# Database
./scripts/docker-prod.sh backup
./scripts/docker-prod.sh db migrate

# Maintenance
./scripts/docker-prod.sh cleanup
./scripts/docker-prod.sh restart
```

### SSL/TLS Configuration

The production setup uses Traefik with Let's Encrypt:

1. Configure domain names in `docker-compose.yml`
2. Set `ACME_EMAIL` in `.env.production`
3. Ensure DNS points to your server
4. Certificates are automatically issued and renewed

### Monitoring

Access monitoring services:
- Grafana: https://grafana.your-domain.com
- Prometheus: https://prometheus.your-domain.com
- Traefik Dashboard: https://traefik.your-domain.com

## Docker Images

### Optimized Multi-Stage Builds

Both Dockerfiles use multi-stage builds for optimization:

#### Development (Dockerfile.dev)
- Based on Node.js 20 Alpine
- Includes development tools
- Hot reload support
- Source code mounting

#### Production (Dockerfile)
- Multi-stage build with separate dependency stages
- Build cache optimization with BuildKit
- Security: non-root user, minimal attack surface
- Health checks included
- Optimized for size and performance

### Performance Optimizations

1. **Layer Caching**
   - Dependencies installed before source code copy
   - Separate stages for different dependency types
   - BuildKit cache mounts for package managers

2. **Image Size**
   - Alpine Linux base images
   - Multi-stage builds to exclude build dependencies
   - Node.js standalone output for minimal runtime

3. **Security**
   - Non-root user execution
   - Minimal base images
   - Security updates in base layers

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=mysql://user:pass@host:port/database
MYSQL_ROOT_PASSWORD=secure-password
MYSQL_PASSWORD=user-password

# Authentication
NEXTAUTH_SECRET=min-32-character-secret
NEXTAUTH_URL=https://your-domain.com

# Redis
REDIS_URL=redis://host:port
REDIS_PASSWORD=redis-password

# Email
EMAIL_SERVER_HOST=smtp.provider.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=username
EMAIL_SERVER_PASSWORD=password
EMAIL_FROM=noreply@your-domain.com
```

### Optional Variables

```bash
# Monitoring
SENTRY_DSN=https://sentry-dsn
GRAFANA_PASSWORD=grafana-password

# SSL
ACME_EMAIL=admin@your-domain.com

# Features
ENABLE_MONITORING=true
ENABLE_ANALYTICS=true
LOG_LEVEL=info
```

## Volumes and Persistence

### Development
- `node_modules_cache`: Node.js dependencies cache
- `mysql_data`: Database storage
- `redis_data`: Redis persistence

### Production
- `/data/mysql`: Database files (bind mount)
- `/data/redis`: Redis persistence (bind mount)
- `traefik_certs`: SSL certificates
- `prometheus_data`: Metrics storage
- `grafana_data`: Dashboard configurations
- `loki_data`: Log storage

## Networking

### Development
- `nest-shield-dev`: Internal bridge network (172.20.0.0/16)

### Production
- `nest-shield`: Internal services network (172.21.0.0/16)
- `traefik`: External proxy network

## Resource Management

### Development Limits
- Suitable for development machines
- No resource constraints by default
- Can be limited by editing compose files

### Production Limits
```yaml
dashboard:
  deploy:
    resources:
      limits:
        memory: 512M
        cpus: '0.5'
      reservations:
        memory: 256M
        cpus: '0.25'
```

## Backup and Recovery

### Automated Backups
```bash
# Create backup
./scripts/docker-prod.sh backup

# Restore from backup
./scripts/docker-prod.sh restore backups/mysql_backup_20240116_120000.sql.gz
```

### Backup Schedule
- Database: Automatic retention of 7 days
- Volumes: Manual backup recommended
- Configuration: Store in version control

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check port usage
   netstat -tulpn | grep :3001
   
   # Modify ports in docker-compose files
   ```

2. **Permission Issues**
   ```bash
   # Fix data directory permissions
   sudo chown -R $(id -u):$(id -g) data/
   ```

3. **Memory Issues**
   ```bash
   # Check Docker memory
   docker system df
   docker system prune
   ```

4. **SSL Certificate Issues**
   ```bash
   # Check Traefik logs
   ./scripts/docker-prod.sh logs traefik
   
   # Verify DNS configuration
   dig your-domain.com
   ```

### Debug Commands

```bash
# Check container health
./scripts/docker-dev.sh health

# View detailed logs
./scripts/docker-prod.sh logs dashboard 500

# Execute shell in container
./scripts/docker-dev.sh exec dashboard bash

# Check resource usage
docker stats
```

## Security Considerations

### Development
- Default passwords (change for shared environments)
- All services exposed on localhost
- Debug features enabled

### Production
- Strong passwords in secrets
- SSL/TLS encryption
- Non-root container execution
- Regular security updates
- Firewall configuration recommended

### Security Checklist

- [ ] Change default passwords
- [ ] Configure SSL certificates
- [ ] Enable firewall rules
- [ ] Regular backup testing
- [ ] Monitor security logs
- [ ] Update base images regularly

## Performance Tuning

### Database Optimization
- Connection pooling configured
- Query cache settings optimized
- InnoDB buffer pool sized appropriately

### Redis Optimization
- Memory policies configured
- Persistence settings for use case
- Connection limits set

### Application Optimization
- Production builds with optimization
- Static asset caching
- Database connection pooling

## Maintenance

### Regular Tasks

1. **Updates**
   ```bash
   ./scripts/docker-prod.sh update
   ```

2. **Backups**
   ```bash
   ./scripts/docker-prod.sh backup
   ```

3. **Cleanup**
   ```bash
   ./scripts/docker-prod.sh cleanup
   ```

4. **Health Checks**
   ```bash
   ./scripts/docker-prod.sh health
   ```

### Monitoring Alerts

Configure alerts for:
- Container health status
- Resource usage (CPU, memory, disk)
- Application errors
- SSL certificate expiration
- Database connection issues

## Support

For issues and questions:
- Check logs: `./scripts/docker-*.sh logs <service>`
- Review health status: `./scripts/docker-*.sh health`
- Consult main documentation
- Open GitHub issues for bugs