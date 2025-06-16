# Architecture Overview

This document provides a comprehensive overview of the NestShield Dashboard architecture, its components, and how they interact with each other.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          User Interface                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Real-time  │  │Configuration│  │   Alerts    │  │  Analytics  │ │
│  │ Monitoring  │  │ Management  │  │ Management  │  │  & Reports  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                      Next.js Frontend                              │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   REST API  │  │  WebSocket  │  │    Auth     │  │   Health    │ │
│  │ Endpoints   │  │ Real-time   │  │ Middleware  │  │   Checks    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                    NestShield Core API                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   MariaDB   │  │    Redis    │  │   File      │  │   External  │ │
│  │  Database   │  │   Cache     │  │   System    │  │   Services  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend Layer (Next.js)

The dashboard frontend is built with Next.js 15 and provides a modern, responsive user interface.

#### Key Technologies
- **Next.js 15**: React framework with App Router
- **TypeScript**: Full type safety
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/ui**: High-quality UI components
- **React Query**: Data fetching and caching
- **Zustand**: State management
- **Chart.js & Recharts**: Data visualization
- **Socket.io Client**: Real-time communication

#### Component Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── [locale]/          # Internationalized routes
│   │   ├── page.tsx       # Dashboard home
│   │   ├── configuration/ # Configuration management
│   │   ├── alerts/        # Alert management
│   │   └── analytics/     # Analytics and reports
│   └── api/               # API routes
├── components/            # Reusable components
│   ├── ui/               # Base UI components
│   ├── layout/           # Layout components
│   ├── realtime/         # Real-time components
│   ├── configuration/    # Configuration forms
│   └── charts/           # Chart components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
├── stores/               # State management
├── types/                # TypeScript types
└── styles/               # Global styles
```

### 2. API Layer (NestShield Core)

The backend API provides monitoring, configuration, and real-time capabilities.

#### Core Services
- **MonitoringService**: System metrics and health monitoring
- **ConfigurationService**: Dynamic configuration management
- **MetricsService**: Performance metrics collection
- **AlertingService**: Alert generation and management
- **WebSocket Gateway**: Real-time communication

#### Service Architecture

```
NestShield Core/
├── controllers/          # HTTP controllers
│   ├── monitoring.controller.ts
│   └── configuration.controller.ts
├── services/            # Business logic
│   ├── monitoring.service.ts
│   ├── configuration.service.ts
│   ├── metrics.service.ts
│   └── alerting.service.ts
├── gateways/           # WebSocket gateways
│   └── monitoring.gateway.ts
├── modules/            # NestJS modules
│   ├── shield.module.ts
│   └── monitoring.module.ts
└── interfaces/         # Type definitions
```

### 3. Data Layer

#### Database (MariaDB)
- **Primary storage** for configuration, metrics, and historical data
- **ACID compliance** for data integrity
- **Optimized schemas** for time-series data
- **Indexes** for fast query performance

#### Cache (Redis)
- **High-speed caching** for frequently accessed data
- **Real-time data** temporary storage
- **Session management**
- **Pub/Sub messaging** for real-time updates

## Data Flow Architecture

### Real-time Data Flow

```
┌─────────────┐    WebSocket    ┌─────────────┐    Events     ┌─────────────┐
│  Dashboard  │◄───────────────►│   Gateway   │◄─────────────►│  Services   │
│  Frontend   │                 │             │               │             │
└─────────────┘                 └─────────────┘               └─────────────┘
        │                              │                              │
        │                              │                              │
        ▼                              ▼                              ▼
┌─────────────┐                ┌─────────────┐               ┌─────────────┐
│    Cache    │                │   Redis     │               │   Database  │
│  (Browser)  │                │ Pub/Sub     │               │  (MariaDB)  │
└─────────────┘                └─────────────┘               └─────────────┘
```

### Configuration Flow

```
┌─────────────┐     REST API     ┌─────────────┐    Validation   ┌─────────────┐
│   Config    │─────────────────►│Configuration│────────────────►│   Database  │
│    Forms    │                  │ Controller  │                 │   Storage   │
└─────────────┘                  └─────────────┘                 └─────────────┘
        │                               │                               │
        │                               │                               │
        ▼                               ▼                               ▼
┌─────────────┐                ┌─────────────┐               ┌─────────────┐
│ Real-time   │                │   Events    │               │   Cache     │
│  Updates    │◄───────────────│ Emitter     │◄──────────────│ Invalidation│
└─────────────┘                └─────────────┘               └─────────────┘
```

## Component Interactions

### Monitoring Components

#### Real-time Dashboard
```typescript
// Real-time metrics flow
WebSocket Connection → useRealtimeMetrics Hook → State Update → UI Refresh
                   ↓
            Automatic Reconnection
```

#### Configuration Management
```typescript
// Configuration management flow
Form Submission → Validation → API Call → Database Update → Cache Invalidation → WebSocket Broadcast
```

#### Alert System
```typescript
// Alert processing flow
Metric Threshold → Alert Generation → Database Storage → WebSocket Notification → UI Update
```

## Security Architecture

### Authentication & Authorization

```
┌─────────────┐     Auth Check    ┌─────────────┐    Session     ┌─────────────┐
│   Client    │──────────────────►│ Middleware  │───────────────►│   Session   │
│  Request    │                   │             │                │   Store     │
└─────────────┘                   └─────────────┘                └─────────────┘
        │                                │                              │
        │                                │                              │
        ▼                                ▼                              ▼
┌─────────────┐                ┌─────────────┐               ┌─────────────┐
│ Protected   │                │   Role      │               │    User     │
│  Resource   │◄───────────────│  Validation │◄──────────────│  Database   │
└─────────────┘                └─────────────┘               └─────────────┘
```

### Security Layers

1. **Transport Security**: HTTPS/WSS in production
2. **Authentication**: Session-based authentication
3. **Authorization**: Role-based access control
4. **CSRF Protection**: Token-based CSRF protection
5. **XSS Prevention**: Content Security Policy
6. **Input Validation**: Server-side validation
7. **Rate Limiting**: API rate limiting

## Scalability Architecture

### Horizontal Scaling

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Dashboard   │     │ Dashboard   │     │ Dashboard   │
│ Instance 1  │     │ Instance 2  │     │ Instance N  │
└─────────────┘     └─────────────┘     └─────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                           │
                    ┌─────────────┐
                    │ Load        │
                    │ Balancer    │
                    └─────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  NestShield │     │  NestShield │     │  NestShield │
│   Core 1    │     │   Core 2    │     │   Core N    │
└─────────────┘     └─────────────┘     └─────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                ┌─────────────────┐
                │   Shared        │
                │   Database      │
                │   & Cache       │
                └─────────────────┘
```

### Performance Optimizations

1. **Frontend Optimizations**:
   - Code splitting and lazy loading
   - Image optimization
   - Bundle size optimization
   - CDN usage for static assets

2. **Backend Optimizations**:
   - Database query optimization
   - Redis caching strategies
   - Connection pooling
   - Async processing

3. **Real-time Optimizations**:
   - WebSocket connection pooling
   - Event throttling
   - Selective data subscription
   - Compression

## Deployment Architecture

### Development Environment

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Next.js    │     │ NestShield  │     │   Local     │
│Development  │────►│    Core     │────►│  Database   │
│   Server    │     │ Development │     │  & Redis    │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Production Environment

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Nginx     │     │  Dashboard  │     │ NestShield  │
│   Proxy     │────►│  Container  │────►│    Core     │
│             │     │             │     │  Container  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                    │
                           │                    │
                           ▼                    ▼
                ┌─────────────────────────────────────┐
                │         Database Cluster           │
                │      (MariaDB + Redis)             │
                └─────────────────────────────────────┘
```

## Error Handling Architecture

### Error Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │  Error      │     │   Logging   │
│   Error     │────►│ Boundary    │────►│   Service   │
│             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
        │                   │                   │
        │                   │                   │
        ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │     │  Fallback   │     │   Error     │
│Notification │     │    UI       │     │ Dashboard   │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Error Categories

1. **Network Errors**: Connection failures, timeouts
2. **Authentication Errors**: Login failures, session expiry
3. **Validation Errors**: Invalid input, constraint violations
4. **System Errors**: Database errors, service unavailability
5. **Real-time Errors**: WebSocket disconnections, message failures

## Monitoring Architecture

### Self-Monitoring

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Application │     │   Health    │     │   Metrics   │
│  Metrics    │────►│   Checks    │────►│  Dashboard  │
│             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
        │                   │                   │
        │                   │                   │
        ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Alerts   │     │   External  │     │   Status    │
│             │     │ Monitoring  │     │    Page     │
│             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Metrics Collection

- **Performance Metrics**: Response times, throughput
- **System Metrics**: CPU, memory, disk usage
- **Application Metrics**: Error rates, user activity
- **Business Metrics**: Feature usage, conversion rates

## Technology Stack

### Frontend Stack
- **Framework**: Next.js 15 (React 19)
- **Language**: TypeScript 5.8+
- **Styling**: Tailwind CSS 4.x
- **Components**: Shadcn/ui (Radix UI)
- **State**: Zustand + React Query
- **Charts**: Chart.js + Recharts
- **Real-time**: Socket.io Client
- **Forms**: React Hook Form + Zod
- **Internationalization**: next-intl
- **Testing**: Vitest + Playwright

### Backend Stack
- **Framework**: NestJS 11
- **Language**: TypeScript 5.8+
- **Database**: MariaDB 10.11
- **ORM**: Drizzle ORM
- **Cache**: Redis 7.0
- **WebSocket**: Socket.io
- **Validation**: Class Validator
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest + Supertest

### DevOps Stack
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **Logging**: Winston + ELK Stack
- **Error Tracking**: Sentry
- **Load Balancing**: Nginx
- **SSL**: Let's Encrypt

## Design Patterns

### Frontend Patterns
- **Component Composition**: Reusable UI components
- **Custom Hooks**: Reusable stateful logic
- **Provider Pattern**: Context-based state sharing
- **Observer Pattern**: Real-time data updates
- **Error Boundaries**: Graceful error handling

### Backend Patterns
- **Dependency Injection**: Service composition
- **Repository Pattern**: Data access abstraction
- **Observer Pattern**: Event-driven architecture
- **Strategy Pattern**: Configurable algorithms
- **Factory Pattern**: Service instantiation

## Next Steps

Now that you understand the architecture:

1. [Configuration Guide](../configuration/) - Set up advanced configurations
2. [API Reference](../api/) - Explore the API endpoints
3. [Examples](../examples/) - See practical implementation examples
4. [Troubleshooting](../troubleshooting/) - Common issues and solutions

---

**Architecture overview complete!** You now have a comprehensive understanding of how the NestShield Dashboard components work together.