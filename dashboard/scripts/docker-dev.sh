#!/bin/bash

# NestShield Dashboard - Development Docker Management Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.dev.yml"
PROJECT_NAME="nest-shield-dashboard-dev"

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

# Create necessary directories and files
setup_env() {
    log "Setting up development environment..."
    
    # Create data directories
    mkdir -p data/{mysql,redis}
    mkdir -p logs
    mkdir -p uploads
    
    # Create .env.local if it doesn't exist
    if [[ ! -f .env.local ]]; then
        cp .env.example .env.local
        warning "Created .env.local from .env.example. Please update the values as needed."
    fi
    
    # Set appropriate permissions
    chmod 755 data
    chmod 755 logs uploads
    
    success "Environment setup completed"
}

# Start development environment
start() {
    log "Starting development environment..."
    check_docker
    setup_env
    
    # Start with optional playground profile
    if [[ "$1" == "with-playground" ]]; then
        log "Starting with playground..."
        docker compose -f "$COMPOSE_FILE" --profile playground up -d
    else
        docker compose -f "$COMPOSE_FILE" up -d
    fi
    
    # Wait for services to be healthy
    log "Waiting for services to be ready..."
    sleep 10
    
    # Check service health
    check_health
    
    success "Development environment started successfully!"
    show_urls
}

# Stop development environment
stop() {
    log "Stopping development environment..."
    docker compose -f "$COMPOSE_FILE" down
    success "Development environment stopped"
}

# Restart development environment
restart() {
    log "Restarting development environment..."
    stop
    start "$1"
}

# Check service health
check_health() {
    log "Checking service health..."
    
    services=("mysql" "redis" "dashboard")
    for service in "${services[@]}"; do
        if docker compose -f "$COMPOSE_FILE" ps "$service" | grep -q "healthy\|running"; then
            echo -e "  ${GREEN}✓${NC} $service is running"
        else
            echo -e "  ${RED}✗${NC} $service is not healthy"
        fi
    done
}

# Show service URLs
show_urls() {
    log "Service URLs:"
    echo -e "  ${GREEN}Dashboard:${NC}      http://localhost:3001"
    echo -e "  ${GREEN}Playground:${NC}     http://localhost:3000 (if enabled)"
    echo -e "  ${GREEN}Adminer:${NC}        http://localhost:8080"
    echo -e "  ${GREEN}Redis Commander:${NC} http://localhost:8081"
    echo -e "  ${GREEN}MailHog:${NC}        http://localhost:8025"
    echo ""
    echo -e "  ${BLUE}Database:${NC}       mysql://root:password@localhost:3306/nest_shield_dev"
    echo -e "  ${BLUE}Redis:${NC}          redis://localhost:6379"
}

# Show logs
logs() {
    service=${1:-dashboard}
    log "Showing logs for $service..."
    docker compose -f "$COMPOSE_FILE" logs -f "$service"
}

# Execute command in container
exec() {
    service=${1:-dashboard}
    shift
    command=${*:-bash}
    log "Executing '$command' in $service container..."
    docker compose -f "$COMPOSE_FILE" exec "$service" $command
}

# Clean up development environment
clean() {
    log "Cleaning up development environment..."
    
    # Stop and remove containers
    docker compose -f "$COMPOSE_FILE" down -v --remove-orphans
    
    # Remove images
    if [[ "$1" == "--images" ]]; then
        warning "Removing development images..."
        docker compose -f "$COMPOSE_FILE" down --rmi all
    fi
    
    # Clean up data directories
    if [[ "$1" == "--all" ]]; then
        warning "Removing all data directories..."
        sudo rm -rf data logs uploads
    fi
    
    success "Development environment cleaned up"
}

# Build images
build() {
    log "Building development images..."
    docker compose -f "$COMPOSE_FILE" build --no-cache
    success "Images built successfully"
}

# Update containers
update() {
    log "Updating development containers..."
    docker compose -f "$COMPOSE_FILE" pull
    restart
    success "Containers updated successfully"
}

# Show status
status() {
    log "Development environment status:"
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    check_health
}

# Database operations
db() {
    case "$1" in
        "migrate")
            log "Running database migrations..."
            exec dashboard pnpm run db:migrate
            ;;
        "seed")
            log "Seeding database..."
            exec dashboard pnpm run db:seed
            ;;
        "reset")
            log "Resetting database..."
            exec dashboard pnpm run db:reset
            ;;
        "shell")
            log "Opening database shell..."
            docker compose -f "$COMPOSE_FILE" exec mysql mysql -u root -ppassword nest_shield_dev
            ;;
        *)
            error "Unknown database command. Use: migrate, seed, reset, or shell"
            ;;
    esac
}

# Help function
help() {
    echo "NestShield Dashboard - Development Docker Management"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  start [with-playground]  Start development environment"
    echo "  stop                     Stop development environment"
    echo "  restart [with-playground] Restart development environment"
    echo "  status                   Show environment status"
    echo "  logs [service]           Show logs for service (default: dashboard)"
    echo "  exec [service] [command] Execute command in container"
    echo "  build                    Build development images"
    echo "  update                   Update containers"
    echo "  clean [--images|--all]   Clean up environment"
    echo "  db [migrate|seed|reset|shell] Database operations"
    echo "  urls                     Show service URLs"
    echo "  health                   Check service health"
    echo "  help                     Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 start                 # Start basic development environment"
    echo "  $0 start with-playground # Start with playground included"
    echo "  $0 logs dashboard        # Show dashboard logs"
    echo "  $0 exec dashboard bash   # Open bash in dashboard container"
    echo "  $0 db migrate            # Run database migrations"
    echo "  $0 clean --all           # Remove everything including data"
}

# Main command handling
case "$1" in
    "start")
        start "$2"
        ;;
    "stop")
        stop
        ;;
    "restart")
        restart "$2"
        ;;
    "status")
        status
        ;;
    "logs")
        logs "$2"
        ;;
    "exec")
        shift
        exec "$@"
        ;;
    "build")
        build
        ;;
    "update")
        update
        ;;
    "clean")
        clean "$2"
        ;;
    "db")
        shift
        db "$@"
        ;;
    "urls")
        show_urls
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