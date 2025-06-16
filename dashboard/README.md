# NestShield Dashboard

A comprehensive, modern, and beautiful real-time dashboard for monitoring and managing NestShield protection services. Built with Next.js 15, TypeScript, Tailwind CSS, and Shadcn/ui components.

## 🚀 Features

### Core Features

- **🌓 Dark/Light Mode**: Full theme support with system preference detection
- **🌍 Multi-language Support**: English and Persian/Farsi with RTL support
- **📊 Real-time Metrics**: Live charts and statistics with WebSocket support
- **🔧 Remote Configuration**: Manage all NestShield settings remotely
- **🔐 No Authentication Required**: Direct access for easy setup
- **💾 Database Integration**: MariaDB with Drizzle ORM for data persistence
- **⚡ Redis Integration**: Caching and real-time data with Redis
- **🏥 Health Monitoring**: Comprehensive health checks and system status

### 10 Advanced Features

1. **🛡️ Security Scanner**: Automated security vulnerability scanning and reporting
2. **🚀 Performance Optimizer**: AI-powered performance optimization suggestions
3. **📈 Traffic Analyzer**: Deep traffic pattern analysis with machine learning insights
4. **🔮 Predictive Scaling**: ML-based auto-scaling recommendations
5. **📋 Compliance Monitor**: Regulatory compliance monitoring and reporting
6. **💰 Cost Optimizer**: Resource usage optimization for cost reduction
7. **👥 API Governance**: API lifecycle management and governance tools
8. **🚨 Incident Response**: Automated incident detection and response system
9. **🔒 Data Privacy Scanner**: PII and sensitive data detection and protection
10. **📊 Business Intelligence**: Advanced analytics and business insights dashboard

## 🛠️ Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with CSS Variables
- **UI Components**: Shadcn/ui (Radix UI primitives)
- **Database**: MariaDB with Drizzle ORM
- **Caching**: Redis with IORedis
- **Charts**: Chart.js with React Chart.js 2 and Recharts
- **Internationalization**: next-intl
- **Theme**: next-themes
- **State Management**: Zustand & TanStack Query
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React
- **Animations**: Framer Motion

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm/pnpm
- MariaDB/MySQL database
- Redis server
- NestShield API running

### Installation

1. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

2. **Environment Setup**
   ```bash
   # Copy environment template
   cp .env.example .env.development
   
   # Edit the environment variables
   nano .env.development
   ```

3. **Configure Environment Variables**
   ```env
   # Database Configuration
   DATABASE_URL="mysql://username:password@localhost:3306/nest_shield_dashboard"
   DB_HOST="localhost"
   DB_PORT="3306"
   DB_USER="username"
   DB_PASSWORD="password"
   DB_NAME="nest_shield_dashboard"

   # Redis Configuration
   REDIS_URL="redis://localhost:6379"
   REDIS_HOST="localhost"
   REDIS_PORT="6379"

   # NestShield API Configuration
   NEST_SHIELD_API_URL="http://localhost:3000"
   NEST_SHIELD_API_KEY="your-api-key"
   ```

4. **Database Setup**
   ```bash
   # Generate database schema
   npm run db:generate
   
   # Run migrations
   npm run db:migrate
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

6. **Access Dashboard**
   Open [http://localhost:3001](http://localhost:3001) in your browser

## 📊 Dashboard Features

### Main Dashboard
- **Overview**: System health, protection status, and key metrics
- **Real-time Metrics**: Live charts showing request patterns, response times, and error rates
- **Protection Status**: Current status of all NestShield protection mechanisms
- **Recent Alerts**: Latest security and performance alerts

### Health Monitoring
- **System Health**: Comprehensive health checks for all services
- **Service Status**: Individual service monitoring (Database, Redis, API)
- **Resource Usage**: CPU, memory, and network utilization
- **Uptime Tracking**: Service availability and performance metrics

## 🌐 API Endpoints

### Health Check
```
GET /api/health
```

Returns comprehensive system health information including database, Redis, NestShield API status, and system resources.

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start development server

# Building
npm run build           # Build for production
npm run start           # Start production server

# Database
npm run db:generate     # Generate migration files
npm run db:migrate      # Run database migrations
npm run db:studio       # Open Drizzle Studio

# Code Quality
npm run lint            # Run ESLint
npm run check-types     # TypeScript type checking
```

## 🌍 Internationalization

### Supported Languages
- **English (en)**: Primary language with comprehensive translations
- **Persian/Farsi (fa)**: Full RTL support with Persian translations

## 🚀 Deployment

### Production Build
```bash
npm run build
npm run start
```

### Environment Variables for Production
Ensure all production environment variables are set in `.env.production`

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check MariaDB/MySQL server status
   - Verify connection credentials

2. **Redis Connection Failed**
   - Verify Redis server is running
   - Check Redis configuration

3. **NestShield API Unreachable**
   - Verify NestShield API is running
   - Check API URL configuration

## 📄 License

This project is part of the NestShield ecosystem.

---

Built with ❤️ by [Ali Torki](https://github.com/ali-master) for the NestShield ecosystem
