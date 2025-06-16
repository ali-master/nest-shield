#!/bin/bash

# NestShield Dashboard - Production Docker Management Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
PROJECT_NAME="nest-shield-dashboard"
BACKUP_DIR="backups"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running. Please start Docker and try again."
    fi
}

# Check production requirements
check_production_requirements() {
    log "Checking production requirements..."
    
    # Check if .env.production exists
    if [[ ! -f .env.production ]]; then
        error ".env.production file not found. Please create it from .env.example"
    fi
    
    # Check if secrets directory exists
    if [[ ! -d secrets ]]; then
        warning "Secrets directory not found. Creating..."
        mkdir -p secrets
        echo "Please populate secrets directory with required files:"
        echo "  - mysql_root_password.txt"
        echo "  - mysql_password.txt"
        echo "  - nextauth_secret.txt"
    fi
    
    # Check data directories
    if [[ ! -d /data ]]; then
        warning "Data directory /data not found. Creating with proper permissions..."
        sudo mkdir -p /data/{mysql,redis}
        sudo chown -R $(id -u):$(id -g) /data
    fi
    
    success "Production requirements check completed"
}

# Setup production environment
setup_production() {
    log "Setting up production environment..."
    check_production_requirements
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Create necessary directories
    mkdir -p logs uploads
    
    # Set appropriate permissions
    chmod 755 logs uploads
    chmod 600 secrets/* 2>/dev/null || true
    
    # Create external networks if they don't exist
    docker network create traefik 2>/dev/null || true
    
    success "Production environment setup completed"
}

# Deploy to production
deploy() {
    log "Deploying to production..."
    check_docker
    setup_production
    
    # Pull latest images
    docker compose -f "$COMPOSE_FILE" pull
    
    # Start services in correct order
    log "Starting infrastructure services..."
    docker compose -f "$COMPOSE_FILE" up -d mysql redis
    
    # Wait for database to be ready
    log "Waiting for database to be ready..."
    sleep 30
    
    # Run database migrations
    log "Running database migrations..."
    docker compose -f "$COMPOSE_FILE" run --rm dashboard pnpm run db:migrate
    
    # Start remaining services
    log "Starting application services..."
    docker compose -f "$COMPOSE_FILE" up -d
    
    # Wait for services to be healthy
    log "Waiting for services to be ready..."
    sleep 20
    
    # Check service health
    check_health
    
    success "Production deployment completed successfully!"
    show_production_info
}

# Stop production environment
stop() {
    log "Stopping production environment..."
    docker compose -f "$COMPOSE_FILE" down
    success "Production environment stopped"
}

# Restart production environment
restart() {
    log "Performing rolling restart..."
    
    # Restart services one by one to minimize downtime
    services=("dashboard" "prometheus" "grafana")
    for service in "${services[@]}"; do
        log "Restarting $service..."
        docker compose -f "$COMPOSE_FILE" restart "$service"
        sleep 10
    done
    
    success "Rolling restart completed"
}

# Check service health
check_health() {
    log "Checking service health..."
    
    services=("mysql" "redis" "dashboard" "traefik" "prometheus" "grafana")
    all_healthy=true
    
    for service in "${services[@]}"; do
        if docker compose -f "$COMPOSE_FILE" ps "$service" | grep -q "healthy\|running"; then
            echo -e "  ${GREEN}✓${NC} $service is running"
        else
            echo -e "  ${RED}✗${NC} $service is not healthy"
            all_healthy=false
        fi
    done
    
    if [[ "$all_healthy" == true ]]; then
        success "All services are healthy"
    else
        warning "Some services are not healthy. Check logs for details."
    fi
}

# Show production information
show_production_info() {
    log "Production environment information:"
    echo -e "  ${GREEN}Dashboard:${NC}    https://dashboard.your-domain.com"
    echo -e "  ${GREEN}Traefik:${NC}      https://traefik.your-domain.com"
    echo -e "  ${GREEN}Grafana:${NC}      https://grafana.your-domain.com"
    echo -e "  ${GREEN}Prometheus:${NC}   https://prometheus.your-domain.com"
    echo ""
    echo -e "  ${BLUE}Note:${NC} Update your domain names in docker-compose.yml"
}

# Show logs
logs() {
    service=${1:-dashboard}
    lines=${2:-100}
    log "Showing last $lines lines of logs for $service..."
    docker compose -f "$COMPOSE_FILE" logs --tail="$lines" -f "$service"
}

# Execute command in container
exec() {
    service=${1:-dashboard}
    shift
    command=${*:-bash}
    log "Executing '$command' in $service container..."
    docker compose -f "$COMPOSE_FILE" exec "$service" $command
}

# Backup database
backup() {
    log "Creating database backup..."
    
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_file="$BACKUP_DIR/mysql_backup_$timestamp.sql"
    
    docker compose -f "$COMPOSE_FILE" exec mysql mysqldump \
        -u root -p"$(cat secrets/mysql_root_password.txt)" \
        --single-transaction \
        --routines \
        --triggers \
        nest_shield > "$backup_file"
    
    # Compress backup
    gzip "$backup_file"
    
    success "Database backup created: ${backup_file}.gz"
    
    # Clean old backups (keep last 7 days)
    find "$BACKUP_DIR" -name "mysql_backup_*.sql.gz" -mtime +7 -delete
}

# Restore database
restore() {
    backup_file="$1"
    
    if [[ -z "$backup_file" ]]; then
        error "Please specify backup file to restore"
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
    fi
    
    warning "This will replace the current database. Are you sure? (y/N)"
    read -r confirm
    
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        log "Restore cancelled"
        exit 0
    fi
    
    log "Restoring database from $backup_file..."
    
    # Decompress if needed
    if [[ "$backup_file" == *.gz ]]; then
        gunzip -c "$backup_file" | docker compose -f "$COMPOSE_FILE" exec -T mysql \
            mysql -u root -p"$(cat secrets/mysql_root_password.txt)" nest_shield
    else
        docker compose -f "$COMPOSE_FILE" exec -T mysql \
            mysql -u root -p"$(cat secrets/mysql_root_password.txt)" nest_shield < "$backup_file"
    fi
    
    success "Database restored successfully"
}

# Update production environment
update() {
    log "Updating production environment..."
    
    # Create backup before update
    backup
    
    # Pull latest images
    docker compose -f "$COMPOSE_FILE" pull
    
    # Perform rolling update
    log "Performing rolling update..."
    
    # Update dashboard with zero downtime
    docker compose -f "$COMPOSE_FILE" up -d --no-deps dashboard
    
    # Wait for new container to be healthy
    sleep 30
    check_health
    
    success "Production environment updated successfully"
}

# Scale services
scale() {
    service="$1"
    replicas="$2"
    
    if [[ -z "$service" || -z "$replicas" ]]; then
        error "Usage: $0 scale <service> <replicas>"
    fi
    
    log "Scaling $service to $replicas replicas..."
    docker compose -f "$COMPOSE_FILE" up -d --scale "$service=$replicas"
    success "Service $service scaled to $replicas replicas"
}

# Show status
status() {
    log "Production environment status:"
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    check_health
    echo ""
    
    # Show resource usage
    log "Resource usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
}

# Clean up old images and containers
cleanup() {
    log "Cleaning up unused Docker resources..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    # Remove unused networks
    docker network prune -f
    
    success "Cleanup completed"
}

# Database operations
db() {
    case "$1" in
        "migrate")
            log "Running database migrations..."
            docker compose -f "$COMPOSE_FILE" exec dashboard pnpm run db:migrate
            ;;
        "backup")
            backup
            ;;
        "restore")
            restore "$2"
            ;;
        "shell")
            log "Opening database shell..."
            docker compose -f "$COMPOSE_FILE" exec mysql mysql \
                -u root -p"$(cat secrets/mysql_root_password.txt)" nest_shield
            ;;
        *)
            error "Unknown database command. Use: migrate, backup, restore, or shell"
            ;;
    esac
}

# Help function
help() {
    echo "NestShield Dashboard - Production Docker Management"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  deploy                   Deploy to production"
    echo "  stop                     Stop production environment"
    echo "  restart                  Perform rolling restart"
    echo "  status                   Show environment status"
    echo "  logs [service] [lines]   Show logs for service"
    echo "  exec [service] [command] Execute command in container"
    echo "  update                   Update production environment"
    echo "  scale [service] [count]  Scale service to specified replicas"
    echo "  cleanup                  Clean up unused Docker resources"
    echo "  db [migrate|backup|restore|shell] Database operations"
    echo "  backup                   Create database backup"
    echo "  restore [file]           Restore database from backup"
    echo "  health                   Check service health"
    echo "  help                     Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 deploy                # Deploy to production"
    echo "  $0 logs dashboard 200    # Show last 200 lines of dashboard logs"
    echo "  $0 scale dashboard 3     # Scale dashboard to 3 replicas"
    echo "  $0 db backup             # Create database backup"
    echo "  $0 db restore backup.sql # Restore from backup file"
}

# Main command handling
case "$1" in
    "deploy")
        deploy
        ;;
    "stop")
        stop
        ;;
    "restart")
        restart
        ;;
    "status")
        status
        ;;
    "logs")
        logs "$2" "$3"
        ;;
    "exec")
        shift
        exec "$@"
        ;;
    "update")
        update
        ;;
    "scale")
        scale "$2" "$3"
        ;;
    "cleanup")
        cleanup
        ;;
    "db")
        shift
        db "$@"
        ;;
    "backup")
        backup
        ;;
    "restore")
        restore "$2"
        ;;
    "health")
        check_health
        ;;
    "help"|"--help"|"-h"|"")
        help
        ;;
    *)
        error "Unknown command: $1. Use '$0 help' for available commands."
        ;;
esac