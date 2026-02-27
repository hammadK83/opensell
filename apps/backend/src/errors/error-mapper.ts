import { APP_ERROR_CODES, type AppErrorCode } from './app-error-codes.js';
import { API_ERROR_CODES, type ApiErrorCode } from '@opensell/shared';

// Mapping internal to external errors
export const AppToApiErrorMap: Record<AppErrorCode, ApiErrorCode> = {
  // TODO: Add specific mappings as we define internal error codes
  [APP_ERROR_CODES.UNKNOWN_ERROR]: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
};
