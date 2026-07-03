/**
 * Error Extraction Utilities
 * 
 * Centralized error handling for API responses.
 * Extracts user-friendly error messages from various error formats.
 */

import axios from 'axios';

/**
 * HTTP Status Code to Error Message Mapping
 */
const STATUS_MESSAGES: Record<number, string> = {
  400: 'Invalid request. Please check your input.',
  401: 'Unauthorized. Please log in again.',
  403: 'Access denied. You don\'t have permission.',
  404: 'Resource not found.',
  409: 'Conflict. Resource already exists.',
  422: 'Validation failed. Please check your input.',
  429: 'Too many requests. Please try again later.',
  500: 'Server error. Please try again later.',
  502: 'Bad gateway. Server is temporarily unavailable.',
  503: 'Service unavailable. Please try again later.',
  504: 'Gateway timeout. Request took too long.',
};

/**
 * Extract user-friendly error message from API error
 * 
 * Handles:
 * - Axios errors with nested message structures
 * - HTTP status codes
 * - Error objects
 * - Plain strings
 * - Unknown error types
 */
export function extractError(e: unknown): string {
  // Handle Axios errors
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as Record<string, unknown> | undefined;
    const raw = data?.message ?? data?.error;
    
    // Handle string messages
    if (typeof raw === 'string' && raw) return raw;
    
    // Handle nested message objects
    if (raw && typeof raw === 'object') {
      const nested = (raw as Record<string, unknown>).message;
      if (typeof nested === 'string' && nested) return nested;
    }
    
    // Handle specific HTTP status codes
    const status = e.response?.status;
    if (status && STATUS_MESSAGES[status]) {
      return STATUS_MESSAGES[status];
    }
    
    // Generic server error for 5xx
    if (status && status >= 500) {
      return 'Server error. Please try again later.';
    }
  }
  
  // Handle Error objects
  if (e instanceof Error) {
    return e.message || 'Something went wrong';
  }
  
  // Handle plain objects with message property
  if (typeof e === 'object' && e !== null) {
    const obj = e as Record<string, unknown>;
    const raw = obj.message ?? obj.error ?? obj.msg;
    if (typeof raw === 'string' && raw) return raw;
  }
  
  // Handle string errors
  if (typeof e === 'string' && e) {
    return e;
  }
  
  // Fallback
  return 'Something went wrong. Please try again.';
}

/**
 * Extract error with custom fallback message
 */
export function extractErrorWithFallback(e: unknown, fallback: string): string {
  const error = extractError(e);
  return error === 'Something went wrong. Please try again.' ? fallback : error;
}

/**
 * Extract error for specific resource type
 */
export function extractResourceError(e: unknown, resource: string, action: string): string {
  const error = extractError(e);
  
  // If it's a generic error, make it more specific
  if (error === 'Something went wrong. Please try again.') {
    return `Failed to ${action} ${resource}. Please try again.`;
  }
  
  return error;
}

/**
 * Check if error is a specific HTTP status code
 */
export function isHttpError(e: unknown, statusCode: number): boolean {
  if (axios.isAxiosError(e)) {
    return e.response?.status === statusCode;
  }
  return false;
}

/**
 * Check if error is unauthorized (401)
 */
export function isUnauthorizedError(e: unknown): boolean {
  return isHttpError(e, 401);
}

/**
 * Check if error is forbidden (403)
 */
export function isForbiddenError(e: unknown): boolean {
  return isHttpError(e, 403);
}

/**
 * Check if error is not found (404)
 */
export function isNotFoundError(e: unknown): boolean {
  return isHttpError(e, 404);
}

/**
 * Check if error is conflict (409)
 */
export function isConflictError(e: unknown): boolean {
  return isHttpError(e, 409);
}

/**
 * Check if error is validation error (422)
 */
export function isValidationError(e: unknown): boolean {
  return isHttpError(e, 422);
}

/**
 * Check if error is server error (5xx)
 */
export function isServerError(e: unknown): boolean {
  if (axios.isAxiosError(e)) {
    const status = e.response?.status;
    return status !== undefined && status >= 500 && status < 600;
  }
  return false;
}
