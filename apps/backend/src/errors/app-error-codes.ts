export const APP_ERROR_CODES = {
  // TODO: Add more specific error codes as needed
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

export type AppErrorCode = (typeof APP_ERROR_CODES)[keyof typeof APP_ERROR_CODES];
