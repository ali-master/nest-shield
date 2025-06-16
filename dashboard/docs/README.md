# NestShield Dashboard Documentation

🛡️ **Comprehensive documentation for the NestShield real-time monitoring and configuration dashboard**

## Quick Start

```bash
# Clone the repository
git clone https://github.com/ali-master/nest-shield.git
cd nest-shield/dashboard

# Install dependencies
npm install

# Set up environment
cp .env.example .env.development

# Start development server
npm run dev
```

## 📚 Documentation Index

### Getting Started
- [Installation Guide](./getting-started/installation.md)
- [Environment Setup](./getting-started/environment.md)
- [First Dashboard](./getting-started/first-dashboard.md)
- [Architecture Overview](./getting-started/architecture.md)

### Configuration
- [Environment Variables](./configuration/environment-variables.md)
- [Database Setup](./configuration/database.md)
- [Redis Configuration](./configuration/redis.md)
- [Security Settings](./configuration/security.md)
- [Internationalization](./configuration/i18n.md)

### API Reference
- [REST API](./api/rest-api.md)
- [WebSocket Events](./api/websocket.md)
- [GraphQL Schema](./api/graphql.md)
- [Monitoring Endpoints](./api/monitoring.md)

### Examples
- [Basic Setup](./examples/basic-setup.md)
- [Advanced Configuration](./examples/advanced-configuration.md)
- [Custom Components](./examples/custom-components.md)
- [Integration Patterns](./examples/integration-patterns.md)

### Troubleshooting
- [Common Issues](./troubleshooting/common-issues.md)
- [Performance Tips](./troubleshooting/performance.md)
- [Debug Guide](./troubleshooting/debugging.md)
- [FAQ](./troubleshooting/faq.md)

## 🚀 Features

### Core Features
- **Real-time Monitoring**: Live metrics and system health monitoring
- **Configuration Management**: Dynamic configuration of protection rules
- **Multi-language Support**: Built-in internationalization (i18n)
- **Dark/Light Themes**: Automatic theme switching
- **Responsive Design**: Works on desktop, tablet, and mobile
- **WebSocket Integration**: Real-time data streaming

### Advanced Features
- **Alert Management**: Comprehensive alerting system
- **Performance Analytics**: Advanced performance insights
- **Security Scanner**: Built-in security vulnerability scanning
- **Load Testing**: Integrated load testing capabilities
- **Report Generation**: Automated report generation
- **Data Export**: Export data in multiple formats

### Technical Features
- **Next.js 15**: Latest React framework with App Router
- **TypeScript**: Full type safety
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/ui**: High-quality UI components
- **Drizzle ORM**: Type-safe database operations
- **Redis Integration**: Caching and real-time data
- **Chart.js & Recharts**: Advanced data visualization

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Dashboard     │    │   NestShield    │    │    Database     │
│   (Next.js)     │◄──►│     Core        │◄──►│   (MariaDB)     │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                        ▲                        ▲
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Redis       │    │   WebSocket     │    │   Monitoring    │
│   (Caching)     │    │  (Real-time)    │    │    Agents       │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 Development

### Prerequisites
- Node.js 18+ or Bun 1.0+
- MariaDB 10.5+
- Redis 6.0+
- NestShield Core API running

### Development Commands

```bash
# Development
npm run dev          # Start development server
npm run dev:next     # Start Next.js only
npm run dev:spotlight # Start with Spotlight debugging

# Building
npm run build        # Build for production
npm run start        # Start production server
npm run build-stats  # Build with bundle analysis

# Database
npm run db:generate  # Generate database migrations
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Drizzle Studio

# Testing
npm run test         # Run unit tests
npm run test:e2e     # Run end-to-end tests

# Code Quality
npm run lint         # Lint code
npm run lint:fix     # Fix linting issues
npm run format       # Format code
npm run check-types  # Type checking
```

### Environment Setup

1. **Database Setup**:
   ```bash
   # Create database
   mysql -u root -p
   CREATE DATABASE nestshield_dashboard;
   CREATE USER 'nestshield'@'localhost' IDENTIFIED BY 'password';
   GRANT ALL PRIVILEGES ON nestshield_dashboard.* TO 'nestshield'@'localhost';
   ```

2. **Redis Setup**:
   ```bash
   # Install and start Redis
   brew install redis
   brew services start redis
   ```

3. **Environment Variables**:
   ```bash
   cp .env.example .env.development
   # Edit .env.development with your configuration
   ```

## 🔒 Security

### Security Features
- **Input Validation**: All inputs are validated and sanitized
- **CSRF Protection**: Built-in CSRF protection
- **XSS Prevention**: Content Security Policy headers
- **Rate Limiting**: API rate limiting
- **Authentication**: Session-based authentication
- **Encryption**: Data encryption at rest and in transit

### Security Best Practices
- Always use HTTPS in production
- Regularly update dependencies
- Use strong database passwords
- Enable Redis AUTH if exposed
- Configure proper CORS settings
- Monitor security logs

## 🚀 Deployment

### Production Deployment

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Set production environment**:
   ```bash
   cp .env.example .env.production
   # Configure production settings
   ```

3. **Deploy using Docker**:
   ```bash
   docker build -t nestshield-dashboard .
   docker run -p 3000:3000 --env-file .env.production nestshield-dashboard
   ```

### Deployment Options
- **Vercel**: Zero-config deployment
- **Docker**: Containerized deployment
- **PM2**: Process management
- **Nginx**: Reverse proxy setup

## 📊 Monitoring

### Health Checks
- `/api/health` - Application health status
- `/api/health/detailed` - Detailed health information
- `/api/metrics` - Prometheus metrics endpoint

### Logging
- Structured JSON logging
- Multiple log levels
- Log rotation
- Error tracking with Sentry

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Write comprehensive tests
- Document new features
- Follow the existing code style
- Update documentation

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](../LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Full Documentation](./)
- **Issues**: [GitHub Issues](https://github.com/ali-master/nest-shield/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ali-master/nest-shield/discussions)
- **Email**: support@usestrict.dev

---

**Made with ❤️ by the NestShield Team**