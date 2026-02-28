import { APP_ERROR_CODES, type AppErrorCode } from './app-error-codes.js';
import { API_ERROR_CODES, type ApiErrorCode } from '@opensell/shared';

// Mapping internal to external errors
export const AppToApiErrorMap: Record<AppErrorCode, ApiErrorCode> = {
  [APP_ERROR_CODES.USER_ALREADY_EXISTS]: API_ERROR_CODES.CONFLICT,
  [APP_ERROR_CODES.INVALID_VERIFICATION_TOKEN]: API_ERROR_CODES.UNAUTHORIZED,
  [APP_ERROR_CODES.UNKNOWN_ERROR]: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
};
