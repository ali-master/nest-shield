import { IProtectionContext } from "../../interfaces/shield-config.interface";

/**
 * Shared key generation utility for all protection services
 */
export class KeyGeneratorUtil {
  /**
   * Generates a unique key for rate limiting, throttling, and other protection mechanisms
   * @param context - The protection context containing request information
   * @param config - Configuration object with optional keyGenerator function
   * @param config.keyGenerator - Optional custom key generator function
   * @param prefix - Optional prefix for the key
   * @returns Generated key string
   */
  static generateKey(
    context: IProtectionContext,
    config: { keyGenerator?: (ctx: IProtectionContext) => string | Promise<string> },
    prefix = "",
  ): string | Promise<string> {
    if (config.keyGenerator) {
      const result = config.keyGenerator(context);
      if (result instanceof Promise) {
        return result.then((key) => (prefix ? `${prefix}:${key}` : key));
      }
      return prefix ? `${prefix}:${result}` : result;
    }

    // Default key generation logic
    const key = context.userId || context.ip || "global";
    return prefix ? `${prefix}:${key}` : key;
  }

  /**
   * Generates a composite key with multiple parts
   * @param parts - Array of key parts to join
   * @param separator - Separator between parts (default: ':')
   * @returns Composite key string
   */
  static generateCompositeKey(parts: string[], separator = ":"): string {
    return parts.filter(Boolean).join(separator);
  }

  /**
   * Sanitizes a key to ensure it's safe for storage backends
   * @param key - The key to sanitize
   * @returns Sanitized key
   */
  static sanitizeKey(key: string): string {
    // Replace problematic characters for storage backends
    return key.replace(/[^\w:\-]/g, "_");
  }
}
