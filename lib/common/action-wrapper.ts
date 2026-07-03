/**
 * Server Action Wrapper
 * 
 * Higher-order function to wrap server actions with consistent error handling.
 * Reduces boilerplate and ensures DRY principle.
 */

import { ActionResult, success, failure } from './action-result';
import { extractError } from './error-handler';
import { ValidationResult } from './validation';

/**
 * Options for action wrapper
 */
interface ActionOptions {
  /** Resource name for error messages (e.g., 'workspace', 'team member') */
  resource?: string;
  /** Action name for error messages (e.g., 'create', 'update', 'delete') */
  action?: string;
  /** Custom error message */
  errorMessage?: string;
}

/**
 * Wrap a server action with error handling
 * 
 * @example
 * export const createWorkspace = wrapAction(
 *   async (payload: CreateWorkspacePayload) => {
 *     const http = await serverHttp();
 *     return http.post(E.create, payload).then(unwrapServer<Workspace>);
 *   },
 *   { resource: 'workspace', action: 'create' }
 * );
 */
export function wrapAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: ActionOptions = {}
): (...args: TArgs) => Promise<ActionResult<TResult>> {
  return async (...args: TArgs): Promise<ActionResult<TResult>> => {
    try {
      const data = await fn(...args);
      return success(data);
    } catch (e) {
      let error: string;
      
      if (options.errorMessage) {
        error = options.errorMessage;
      } else if (options.resource && options.action) {
        error = extractError(e);
        // If generic error, make it specific
        if (error === 'Something went wrong. Please try again.') {
          error = `Failed to ${options.action} ${options.resource}. Please try again.`;
        }
      } else {
        error = extractError(e);
      }
      
      return failure(error);
    }
  };
}

/**
 * Wrap a server action with validation
 * 
 * @example
 * export const createWorkspace = wrapActionWithValidation(
 *   async (payload: CreateWorkspacePayload) => {
 *     const http = await serverHttp();
 *     return http.post(E.create, payload).then(unwrapServer<Workspace>);
 *   },
 *   (payload) => validateRequired(payload.name, 'Workspace name'),
 *   { resource: 'workspace', action: 'create' }
 * );
 */
export function wrapActionWithValidation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  validate: (...args: TArgs) => ValidationResult | Promise<ValidationResult>,
  options: ActionOptions = {}
): (...args: TArgs) => Promise<ActionResult<TResult>> {
  return async (...args: TArgs): Promise<ActionResult<TResult>> => {
    // Run validation
    const validationResult = await validate(...args);
    if (!validationResult.valid) {
      return failure(validationResult.error);
    }
    
    // Run action
    return wrapAction(fn, options)(...args);
  };
}

/**
 * Wrap multiple validations
 */
export function validateAll(
  ...validations: (ValidationResult | Promise<ValidationResult>)[]
): Promise<ValidationResult> {
  return Promise.all(validations).then((results) => {
    for (const result of results) {
      if (!result.valid) {
        return result;
      }
    }
    return { valid: true };
  });
}

/**
 * Create a validated action wrapper
 * 
 * @example
 * const createValidatedAction = createActionWrapper({ resource: 'workspace' });
 * 
 * export const createWorkspace = createValidatedAction(
 *   async (payload: CreateWorkspacePayload) => {
 *     const http = await serverHttp();
 *     return http.post(E.create, payload).then(unwrapServer<Workspace>);
 *   },
 *   (payload) => validateRequired(payload.name, 'Workspace name'),
 *   'create'
 * );
 */
export function createActionWrapper(baseOptions: ActionOptions) {
  return <TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    validate?: (...args: TArgs) => ValidationResult | Promise<ValidationResult>,
    action?: string
  ) => {
    const options = { ...baseOptions, action: action || baseOptions.action };
    
    if (validate) {
      return wrapActionWithValidation(fn, validate, options);
    }
    
    return wrapAction(fn, options);
  };
}
