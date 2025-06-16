/**
 * Common validation utility functions
 */
export class ValidationUtil {
  /**
   * Validates if a value is a positive number
   * @param value - Value to validate
   * @param fieldName - Name of the field for error messages
   * @returns The validated number
   */
  static validatePositiveNumber(value: unknown, fieldName: string): number {
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      throw new Error(`${fieldName} must be a positive number`);
    }
    return num;
  }

  /**
   * Validates if a value is a non-negative number
   * @param value - Value to validate
   * @param fieldName - Name of the field for error messages
   * @returns The validated number
   */
  static validateNonNegativeNumber(value: unknown, fieldName: string): number {
    const num = Number(value);
    if (isNaN(num) || num < 0) {
      throw new Error(`${fieldName} must be a non-negative number`);
    }
    return num;
  }

  /**
   * Validates if a value is within a range
   * @param value - Value to validate
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (inclusive)
   * @param fieldName - Name of the field for error messages
   * @returns The validated number
   */
  static validateNumberInRange(
    value: unknown,
    min: number,
    max: number,
    fieldName: string,
  ): number {
    const num = Number(value);
    if (isNaN(num) || num < min || num > max) {
      throw new Error(`${fieldName} must be between ${min} and ${max}`);
    }
    return num;
  }

  /**
   * Validates if a value is a valid percentage (0-100)
   * @param value - Value to validate
   * @param fieldName - Name of the field for error messages
   * @returns The validated percentage
   */
  static validatePercentage(value: unknown, fieldName: string): number {
    return this.validateNumberInRange(value, 0, 100, fieldName);
  }

  /**
   * Validates if a value is a non-empty string
   * @param value - Value to validate
   * @param fieldName - Name of the field for error messages
   * @returns The validated string
   */
  static validateNonEmptyString(value: unknown, fieldName: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`${fieldName} must be a non-empty string`);
    }
    return value;
  }

  /**
   * Validates if a value is a valid enum value
   * @param value - Value to validate
   * @param enumObject - Enum object to validate against
   * @param fieldName - Name of the field for error messages
   * @returns The validated enum value
   */
  static validateEnum<T extends Record<string, unknown>>(
    value: unknown,
    enumObject: T,
    fieldName: string,
  ): T[keyof T] {
    const values = Object.values(enumObject);
    if (!values.includes(value)) {
      throw new Error(`${fieldName} must be one of: ${values.join(", ")}`);
    }
    return value as T[keyof T];
  }

  /**
   * Validates if a value is a valid URL
   * @param value - Value to validate
   * @param fieldName - Name of the field for error messages
   * @returns The validated URL string
   */
  static validateUrl(value: unknown, fieldName: string): string {
    const str = this.validateNonEmptyString(value, fieldName);
    try {
      new URL(str);
      return str;
    } catch {
      throw new Error(`${fieldName} must be a valid URL`);
    }
  }

  /**
   * Validates if a value is a valid email
   * @param value - Value to validate
   * @param fieldName - Name of the field for error messages
   * @returns The validated email string
   */
  static validateEmail(value: unknown, fieldName: string): string {
    const str = this.validateNonEmptyString(value, fieldName);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
    if (!emailRegex.test(str)) {
      throw new Error(`${fieldName} must be a valid email address`);
    }
    return str;
  }

  /**
   * Validates an array has minimum length
   * @param value - Array to validate
   * @param minLength - Minimum length required
   * @param fieldName - Name of the field for error messages
   * @returns The validated array
   */
  static validateArrayMinLength<T>(value: unknown, minLength: number, fieldName: string): T[] {
    if (!Array.isArray(value) || value.length < minLength) {
      throw new Error(`${fieldName} must be an array with at least ${minLength} items`);
    }
    return value as T[];
  }
}
