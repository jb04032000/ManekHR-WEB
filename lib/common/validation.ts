/**
 * Validation Utilities
 * 
 * Common validation functions for server actions and forms.
 * Ensures consistent validation across the application.
 */

/**
 * Validation result type
 */
export type ValidationResult = 
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validate required string field
 */
export function validateRequired(value: unknown, fieldName: string): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: false, error: `${fieldName} is required` };
  }
  
  if (typeof value === 'string' && !value.trim()) {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }
  
  return { valid: true };
}

/**
 * Validate string is not empty after trimming
 */
export function validateNonEmptyString(value: string | undefined, fieldName: string): ValidationResult {
  if (!value || !value.trim()) {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }
  return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
}

/**
 * Validate mobile number (Indian format)
 */
export function validateMobile(mobile: string): ValidationResult {
  const mobileRegex = /^[+]?[0-9]{10,15}$/;
  if (!mobileRegex.test(mobile.replace(/\s/g, ''))) {
    return { valid: false, error: 'Invalid mobile number' };
  }
  return { valid: true };
}

/**
 * Validate email or mobile
 */
export function validateIdentifier(identifier: string): ValidationResult {
  const trimmed = identifier.trim();
  
  if (!trimmed) {
    return { valid: false, error: 'Email or mobile number is required' };
  }
  
  // Check if it looks like an email
  if (trimmed.includes('@')) {
    return validateEmail(trimmed);
  }
  
  // Otherwise treat as mobile
  return validateMobile(trimmed);
}

/**
 * Validate string length
 */
export function validateLength(
  value: string,
  fieldName: string,
  min?: number,
  max?: number
): ValidationResult {
  const length = value.trim().length;
  
  if (min !== undefined && length < min) {
    return { valid: false, error: `${fieldName} must be at least ${min} characters` };
  }
  
  if (max !== undefined && length > max) {
    return { valid: false, error: `${fieldName} must be at most ${max} characters` };
  }
  
  return { valid: true };
}

/**
 * Validate number is within range
 */
export function validateRange(
  value: number,
  fieldName: string,
  min?: number,
  max?: number
): ValidationResult {
  if (min !== undefined && value < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }
  
  if (max !== undefined && value > max) {
    return { valid: false, error: `${fieldName} must be at most ${max}` };
  }
  
  return { valid: true };
}

/**
 * Validate positive number
 */
export function validatePositive(value: number, fieldName: string): ValidationResult {
  if (value <= 0) {
    return { valid: false, error: `${fieldName} must be positive` };
  }
  return { valid: true };
}

/**
 * Validate array is not empty
 */
export function validateNonEmptyArray<T>(
  value: T[] | undefined,
  fieldName: string
): ValidationResult {
  if (!value || value.length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }
  return { valid: true };
}

/**
 * Validate date string (ISO format)
 */
export function validateDate(date: string, fieldName: string): ValidationResult {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return { valid: false, error: `${fieldName} must be in YYYY-MM-DD format` };
  }
  
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return { valid: false, error: `${fieldName} is not a valid date` };
  }
  
  return { valid: true };
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): ValidationResult {
  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: string,
  allowedValues: readonly T[],
  fieldName: string
): ValidationResult {
  if (!allowedValues.includes(value as T)) {
    return { 
      valid: false, 
      error: `${fieldName} must be one of: ${allowedValues.join(', ')}` 
    };
  }
  return { valid: true };
}

/**
 * Combine multiple validation results
 */
export function combineValidations(...results: ValidationResult[]): ValidationResult {
  for (const result of results) {
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
}

/**
 * Validate object has required fields
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
  obj: T,
  requiredFields: (keyof T)[]
): ValidationResult {
  for (const field of requiredFields) {
    const value = obj[field];
    if (value === undefined || value === null || value === '') {
      return { valid: false, error: `${String(field)} is required` };
    }
  }
  return { valid: true };
}
