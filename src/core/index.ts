/**
 * Core module exports for NestShield
 *
 * This file exports all core functionality including DI tokens,
 * provider factories, constants, and exceptions.
 */

// Constants and Configuration
export * from "./constants";
// Re-export legacy constants for backward compatibility
export {
  DEFAULT_CONFIG,
  SHIELD_DECORATORS,
  SHIELD_INSTANCE,
  SHIELD_METADATA,
  SHIELD_MODULE_OPTIONS,
} from "./constants";

// DI Tokens and Provider Factories
export * from "./di-tokens";

// Exceptions
export * from "./exceptions";

// Injection Decorators
export * from "./injection.decorators";

export * from "./providers.factory";
