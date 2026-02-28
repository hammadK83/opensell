export const APP_ERROR_CODES = {
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

export type AppErrorCode = (typeof APP_ERROR_CODES)[keyof typeof APP_ERROR_CODES];
