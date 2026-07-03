/**
 * Common Utilities Index
 * 
 * Central export point for all common utilities.
 * Import from '@/lib/common' to access all utilities.
 */

// Action Result Types and Helpers
export type { ActionResult } from './action-result';
export {
  success,
  failure,
  isSuccess,
  isFailure,
  unwrap,
  getOrDefault,
  mapResult,
  chainResults,
} from './action-result';

// Error Handling
export {
  extractError,
  extractErrorWithFallback,
  extractResourceError,
  isHttpError,
  isUnauthorizedError,
  isForbiddenError,
  isNotFoundError,
  isConflictError,
  isValidationError,
  isServerError,
} from './error-handler';

// Validation
export type { ValidationResult } from './validation';
export {
  validateRequired,
  validateNonEmptyString,
  validateEmail,
  validateMobile,
  validateIdentifier,
  validateLength,
  validateRange,
  validatePositive,
  validateNonEmptyArray,
  validateDate,
  validateUrl,
  validateEnum,
  combineValidations,
  validateRequiredFields,
} from './validation';

// Action Wrapper
export {
  wrapAction,
  wrapActionWithValidation,
  validateAll,
  createActionWrapper,
} from './action-wrapper';

// UI Handlers
export type { MessageApi } from './ui-handlers';
export {
  handleResult,
  createResultHandler,
  handleWithLoading,
  handleWithState,
  createMutationHandler,
  safeSetArray,
  handleListResult,
  createListLoader,
} from './ui-handlers';
