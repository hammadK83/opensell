export const TOKEN_LENGTH = 80;
export const AUTH_PROVIDER = {
  LOCAL: 'local',
  GOOGLE: 'google',
} as const;
export const PASSWORD_SPECIAL_CHARS = '@$!%*?&';
export const MAX_PASSWORD_BYTES = 72;

// Counts UTF-8 bytes without relying on Node's Buffer, which is not guaranteed in React Native.
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

export const PASSWORD_SPECIAL_CHAR_REGEX = new RegExp(`[${PASSWORD_SPECIAL_CHARS}]`);
export const PASSWORD_REGEX = new RegExp(
  `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[${PASSWORD_SPECIAL_CHARS}]).+$`,
);
