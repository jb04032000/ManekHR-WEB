/**
 * UI Handler Utilities
 * 
 * Common patterns for handling server action results in UI components.
 * Reduces boilerplate in React components.
 */

import { ActionResult } from './action-result';

/**
 * Message API interface (Ant Design compatible)
 */
export interface MessageApi {
  success: (content: string) => void;
  error: (content: string) => void;
  warning: (content: string) => void;
  info: (content: string) => void;
}

/**
 * Options for handling action results
 */
interface HandleResultOptions {
  /** Success message to display */
  successMessage?: string;
  /** Custom error message (overrides server error) */
  errorMessage?: string;
  /** Callback on success */
  onSuccess?: () => void | Promise<void>;
  /** Callback on error */
  onError?: (error: string) => void | Promise<void>;
  /** Show success message (default: true) */
  showSuccess?: boolean;
  /** Show error message (default: true) */
  showError?: boolean;
}

/**
 * Handle action result with message display
 * 
 * @example
 * const res = await createWorkspace(payload);
 * handleResult(res, msgApi, {
 *   successMessage: 'Workspace created',
 *   onSuccess: () => router.push('/dashboard')
 * });
 */
export async function handleResult<T>(
  result: ActionResult<T>,
  msgApi: MessageApi,
  options: HandleResultOptions = {}
): Promise<boolean> {
  const {
    successMessage,
    errorMessage,
    onSuccess,
    onError,
    showSuccess = true,
    showError = true,
  } = options;
  
  if (result.ok) {
    if (showSuccess && successMessage) {
      msgApi.success(successMessage);
    }
    if (onSuccess) {
      await onSuccess();
    }
    return true;
  } else {
    const error = errorMessage || result.error;
    if (showError) {
      msgApi.error(error);
    }
    if (onError) {
      await onError(error);
    }
    return false;
  }
}

/**
 * Create a result handler with default options
 * 
 * @example
 * const handleWorkspaceResult = createResultHandler(msgApi, {
 *   onSuccess: refreshWorkspaces
 * });
 * 
 * await handleWorkspaceResult(result, { successMessage: 'Workspace created' });
 */
export function createResultHandler(
  msgApi: MessageApi,
  defaultOptions: HandleResultOptions = {}
) {
  return <T>(result: ActionResult<T>, options: HandleResultOptions = {}) => {
    return handleResult(result, msgApi, { ...defaultOptions, ...options });
  };
}

/**
 * Handle action with loading state
 * 
 * @example
 * await handleWithLoading(
 *   setLoading,
 *   async () => {
 *     const res = await createWorkspace(payload);
 *     return handleResult(res, msgApi, { successMessage: 'Created' });
 *   }
 * );
 */
export async function handleWithLoading<T>(
  setLoading: (loading: boolean) => void,
  fn: () => Promise<T>
): Promise<T> {
  setLoading(true);
  try {
    return await fn();
  } finally {
    setLoading(false);
  }
}

/**
 * Handle action with loading and error state
 * 
 * @example
 * await handleWithState(
 *   { setLoading, setError },
 *   async () => {
 *     const res = await createWorkspace(payload);
 *     if (!res.ok) throw new Error(res.error);
 *     return res.data;
 *   }
 * );
 */
export async function handleWithState<T>(
  state: {
    setLoading: (loading: boolean) => void;
    setError?: (error: string | null) => void;
  },
  fn: () => Promise<T>
): Promise<T | null> {
  const { setLoading, setError } = state;
  
  setLoading(true);
  if (setError) setError(null);
  
  try {
    const result = await fn();
    return result;
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Something went wrong';
    if (setError) setError(error);
    return null;
  } finally {
    setLoading(false);
  }
}

/**
 * Create a mutation handler with consistent behavior
 * 
 * @example
 * const handleCreate = createMutationHandler({
 *   msgApi,
 *   setLoading,
 *   successMessage: 'Created successfully',
 *   onSuccess: refreshList
 * });
 * 
 * await handleCreate(() => createWorkspace(payload));
 */
export function createMutationHandler<T>(config: {
  msgApi: MessageApi;
  setLoading: (loading: boolean) => void;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (data: T) => void | Promise<void>;
  onError?: (error: string) => void | Promise<void>;
}) {
  return async (fn: () => Promise<ActionResult<T>>): Promise<boolean> => {
    config.setLoading(true);
    try {
      const result = await fn();
      
      if (result.ok) {
        if (config.successMessage) {
          config.msgApi.success(config.successMessage);
        }
        if (config.onSuccess) {
          await config.onSuccess(result.data);
        }
        return true;
      } else {
        const error = config.errorMessage || result.error;
        config.msgApi.error(error);
        if (config.onError) {
          await config.onError(error);
        }
        return false;
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Something went wrong';
      config.msgApi.error(error);
      if (config.onError) {
        await config.onError(error);
      }
      return false;
    } finally {
      config.setLoading(false);
    }
  };
}

/**
 * Safe array setter - ensures array is valid before setting
 */
export function safeSetArray<T>(
  setter: (value: T[]) => void,
  value: unknown
): void {
  setter(Array.isArray(value) ? value : []);
}

/**
 * Handle list fetch result
 */
export async function handleListResult<T>(
  result: ActionResult<T[]>,
  setter: (value: T[]) => void,
  msgApi?: MessageApi,
  errorMessage?: string
): Promise<void> {
  if (result.ok) {
    safeSetArray(setter, result.data);
  } else {
    safeSetArray(setter, []);
    if (msgApi) {
      msgApi.error(errorMessage || result.error);
    }
  }
}

/**
 * Create a list loader with consistent behavior
 */
export function createListLoader<T>(config: {
  setter: (value: T[]) => void;
  msgApi?: MessageApi;
  errorMessage?: string;
  onError?: () => void;
}) {
  return async (fn: () => Promise<ActionResult<T[]>>): Promise<void> => {
    try {
      const result = await fn();
      await handleListResult(
        result,
        config.setter,
        config.msgApi,
        config.errorMessage
      );
      
      if (!result.ok && config.onError) {
        config.onError();
      }
    } catch (e) {
      config.setter([]);
      if (config.msgApi) {
        const error = e instanceof Error ? e.message : 'Failed to load data';
        config.msgApi.error(error);
      }
      if (config.onError) {
        config.onError();
      }
    }
  };
}
