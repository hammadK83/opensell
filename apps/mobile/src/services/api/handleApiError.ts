// 📄 services/api/handleApiError.ts
import axios, { AxiosError } from 'axios';
import { z, ZodError } from 'zod';
import { API_ERROR_CODES, ApiErrorCode } from '@opensell/shared';

interface ApiErrorPayload {
  message?: string;
  code?: ApiErrorCode;
}

/**
 * Parses unknown error objects safely and returns a
 * user-friendly string message to be managed by the UI.
 */
export function getApiErrorMessage(error: unknown): string {
  // Local or Server Zod Validation Failures
  if (error instanceof ZodError) {
    console.error('[Zod Validation Error]:', z.treeifyError(error));
    return 'Something went wrong! You may need to update your app to the latest version.';
  }

  // Axios/Network Failures
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorPayload>;
    console.error('[Axios Network Error]:', axiosError.response?.data || axiosError.message);

    const apiErroData = axiosError.response?.data;
    const errorMessage = apiErroData?.message;
    const errorCode = apiErroData?.code;

    // Map your business-level error codes directly to localized strings
    switch (errorCode) {
      case API_ERROR_CODES.UNAUTHORIZED:
        return errorMessage || 'Incorrect email or password.';

      case API_ERROR_CODES.FORBIDDEN:
        return errorMessage || 'You do not have permission to do this.';

      case API_ERROR_CODES.CONFLICT:
        return errorMessage || 'This information is already registered.';

      case API_ERROR_CODES.VALIDATION_ERROR:
        return errorMessage || 'Please check your input values.';

      case API_ERROR_CODES.NOT_FOUND:
        return errorMessage || 'The requested resource could not be found.';

      case API_ERROR_CODES.INTERNAL_SERVER_ERROR:
        return 'Our servers are experiencing issues. Please try again later.';

      default: {
        // Fallback to standard HTTP status codes if the code string is missing
        const statusCode = axiosError.response?.status;
        if (statusCode && statusCode >= 500) {
          return 'Our servers are down. Please try again later.';
        }
        return 'Cannot reach the server. Please check your internet connection.';
      }
    }
  }

  // Standard JavaScript exceptions
  if (error instanceof Error) {
    console.error('[Runtime Exception]:', error.message);
    return error.message;
  }

  // Fallback final catch-all block
  console.error('[Unknown Uncaught Error]:', error);
  return 'An unexpected error occurred. Please try again.';
}
