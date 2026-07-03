/**
 * Common Action Result Type
 * 
 * Standardized return type for all server actions.
 * Ensures consistent error handling across the application.
 */

export type ActionResult<T> = 
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Success result helper
 */
export function success<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/**
 * Error result helper
 */
export function failure<T = never>(error: string): ActionResult<T> {
  return { ok: false, error };
}

/**
 * Type guard to check if result is successful
 */
export function isSuccess<T>(result: ActionResult<T>): result is { ok: true; data: T } {
  return result.ok === true;
}

/**
 * Type guard to check if result is an error
 */
export function isFailure<T>(result: ActionResult<T>): result is { ok: false; error: string } {
  return result.ok === false;
}

/**
 * Unwrap result data or throw error
 * Use when you want to handle errors with try/catch
 */
export function unwrap<T>(result: ActionResult<T>): T {
  if (result.ok) {
    return result.data;
  }
  throw new Error(result.error);
}

/**
 * Get data or default value
 */
export function getOrDefault<T>(result: ActionResult<T>, defaultValue: T): T {
  return result.ok ? result.data : defaultValue;
}

/**
 * Map result data to another type
 */
export function mapResult<T, U>(
  result: ActionResult<T>,
  fn: (data: T) => U
): ActionResult<U> {
  if (result.ok) {
    return success(fn(result.data));
  }
  return result as ActionResult<U>;
}

/**
 * Chain multiple results together
 */
export async function chainResults<T, U>(
  result: ActionResult<T>,
  fn: (data: T) => Promise<ActionResult<U>>
): Promise<ActionResult<U>> {
  if (result.ok) {
    return fn(result.data);
  }
  return result as ActionResult<U>;
}
