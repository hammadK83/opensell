export const TOKEN_LENGTH = 80;
export const AUTH_PROVIDER = {
  LOCAL: 'local',
  GOOGLE: 'google',
} as const;
export const PASSWORD_SPECIAL_CHARS = '@$!%*?&';
export const PASSWORD_SPECIAL_CHAR_REGEX = new RegExp(`[${PASSWORD_SPECIAL_CHARS}]`);
export const PASSWORD_REGEX = new RegExp(
  `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[${PASSWORD_SPECIAL_CHARS}]).+$`,
);
