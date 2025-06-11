import { Controller, Get, Post, Body } from "@nestjs/common";
import { IShieldConfig } from "@usex/nest-shield";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

interface ConfigExample {
  message: string;
  config: string;
  description: string;
  pros?: string[];
  cons?: string[];
  timestamp: string;
}

@Controller("config")
export class ConfigController {
  @Get("memory-storage")
  getMemoryStorageConfig(): ConfigExample {
    return {
      message: "Memory storage configuration example",
      config: `
// app.module.ts
import { Module } from "@nestjs/common";
import { ShieldModule } from "nest-shield";

@Module({
	imports: [
		ShieldModule.forRoot({
			storage: {
				type: "memory",
			},
		}),
	],
})
export class AppModule {}`,
      description:
        "Uses in-memory storage for protection state. Best for development and single-instance deployments.",
      pros: ["Fast access", "No external dependencies", "Simple setup"],
      cons: ["Not persistent", "Not suitable for distributed systems"],
      timestamp: new Date().toISOString(),
    };
  }

  @Get("redis-storage")
  getRedisStorageConfig(): ConfigExample {
    return {
      message: "Redis storage configuration example",
      config: `
// app.module.ts
import { Module } from "@nestjs/common";
import { ShieldModule } from "nest-shield";

@Module({
	imports: [
		ShieldModule.forRoot({
			storage: {
				type: "redis",
				options: {
					host: "localhost",
					port: 6379,
					password: "your-redis-password",
					db: 0,
					keyPrefix: "nest-shield:",
				},
			},
		}),
	],
})
export class AppModule {}`,
      description:
        "Uses Redis for distributed protection state. Best for production and multi-instance deployments.",
      pros: ["Persistent", "Distributed", "High performance", "Atomic operations"],
      cons: ["Requires Redis server", "Network dependency"],
      timestamp: new Date().toISOString(),
    };
  }

  @Get("memcached-storage")
  getMemcachedStorageConfig(): ConfigExample {
    return {
      message: "Memcached storage configuration example",
      config: `
// app.module.ts
import { Module } from "@nestjs/common";
import { ShieldModule } from "nest-shield";

@Module({
	imports: [
		ShieldModule.forRoot({
			storage: {
				type: "memcached",
				options: {
					servers: ["localhost:11211"],
					options: {
						timeout: 1000,
						retries: 2,
					},
				},
			},
		}),
	],
})
export class AppModule {}`,
      description: "Uses Memcached for distributed protection state.",
      pros: ["Fast", "Distributed", "Simple protocol"],
      cons: ["Not persistent", "Less features than Redis"],
      timestamp: new Date().toISOString(),
    };
  }

  @Get("async-configuration")
  getAsyncConfiguration(): ConfigExample {
    return {
      message: "Async configuration example",
      config: `
// app.module.ts
import { Module } from "@nestjs/common";
import { ShieldModule } from "nest-shield";

@Module({
	imports: [
		ShieldModule.forRootAsync({
			imports: [],
			useFactory: async () => {
				// Load config from environment, database, or external service
				const isProduction = process.env.NODE_ENV === "production";

				return {
					global: {
						enabled: true,
						logging: {
							enabled: !isProduction,
							level: isProduction ? "error" : "debug",
						},
					},
					storage: {
						type: isProduction ? "redis" : "memory",
						options: isProduction
							? {
									host: process.env.REDIS_HOST,
									port: parseInt(process.env.REDIS_PORT || "6379"),
									password: process.env.REDIS_PASSWORD,
							  }
							: undefined,
					},
					rateLimit: {
						enabled: true,
						points: isProduction ? 1000 : 100,
						duration: 60,
					},
				};
			},
		}),
	],
})
export class AppModule {}`,
      description: "Dynamic configuration based on environment variables and runtime conditions.",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("development-config")
  getDevelopmentConfig(): ConfigExample {
    return {
      message: "Development environment configuration",
      config: `
// app.module.ts
import { Module } from "@nestjs/common";
import { ShieldModule } from "nest-shield";

@Module({
	imports: [
		ShieldModule.forRoot({
			global: {
				enabled: true,
				logging: {
					enabled: true,
					level: "debug",
				},
			},
			storage: {
				type: "memory", // Simple memory storage for development
			},
			rateLimit: {
				enabled: true,
				points: 10, // Low limits for easy testing
				duration: 60,
				blockDuration: 30,
			},
			throttle: {
				enabled: true,
				ttl: 10,
				limit: 5,
			},
			circuitBreaker: {
				enabled: true,
				timeout: 1000, // Short timeout for quick testing
				errorThresholdPercentage: 30,
				resetTimeout: 5000,
			},
			overload: {
				enabled: true,
				maxConcurrentRequests: 5,
				maxQueueSize: 2,
				queueTimeout: 3000,
			},
			metrics: {
				enabled: true,
				type: "json",
				exportInterval: 5000,
			},
			advanced: {
				adaptiveProtection: {
					enabled: true,
					learningPeriod: 86400000,
					adjustmentInterval: 30000,
					sensitivityFactor: 0.5,
					anomalyDetection: {
						enabled: true,
						detectorType: "Z-Score Detector",
						sensitivity: 0.5, // Less sensitive for development
						windowSize: 10,
						minDataPoints: 5,
					},
				},
			},
		}),
	],
})
export class AppModule {}`,
      description:
        "Configuration optimized for development with low limits for easy testing and verbose logging.",
      timestamp: new Date().toISOString(),
    };
  }

  @Post("validate-config")
  validateConfiguration(@Body() config: Partial<IShieldConfig>) {
    const validation: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    // Basic validation rules
    if (config.storage?.type === "redis" && !config.storage?.options?.host) {
      validation.errors.push("Redis storage requires host configuration");
      validation.valid = false;
    }

    if (config.rateLimit?.points && config.rateLimit.points < 1) {
      validation.errors.push("Rate limit points must be greater than 0");
      validation.valid = false;
    }

    if (config.circuitBreaker?.timeout && config.circuitBreaker.timeout < 100) {
      validation.warnings.push("Circuit breaker timeout is very low (< 100ms)");
    }

    if (config.overload?.maxConcurrentRequests && config.overload?.maxQueueSize) {
      if (config.overload.maxQueueSize > config.overload.maxConcurrentRequests) {
        validation.suggestions.push(
          "Queue size is larger than max concurrent requests - consider balancing these values",
        );
      }
    }

    if (config.global?.logging?.enabled === false && config.global?.logging?.level === "debug") {
      validation.warnings.push("Logging is disabled but level is set to debug");
    }

    return {
      message: "Configuration validation result",
      validation,
      timestamp: new Date().toISOString(),
    };
  }
}
