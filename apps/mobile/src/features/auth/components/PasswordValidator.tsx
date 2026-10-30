import { Text, View } from 'react-native';
import {
  MAX_PASSWORD_BYTES,
  PASSWORD_SPECIAL_CHAR_REGEX,
  utf8ByteLength,
} from '@opensell/shared';

type Props = {
  password: string;
};

export default function PasswordValidator({ password }: Props) {
  const meetsLength = password.length >= 8;
  const withinByteLimit = utf8ByteLength(password) <= MAX_PASSWORD_BYTES;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = PASSWORD_SPECIAL_CHAR_REGEX.test(password);

  const requirements = [
    {
      met: meetsLength,
      text: 'At least 8 characters',
    },
    {
      met: withinByteLimit,
      text: `At most ${MAX_PASSWORD_BYTES} UTF-8 bytes`,
    },
    {
      met: hasUpper,
      text: 'Contains an uppercase letter',
    },
    {
      met: hasLower,
      text: 'Contains a lowercase letter',
    },
    {
      met: hasNumber,
      text: 'Contains a number',
    },
    {
      met: hasSpecial,
      text: 'Contains a special character',
    },
  ];

  return (
    <View className="mt-2">
      {requirements.map((requirement) => (
        <Text
          key={requirement.text}
          className={`text-medium ${requirement.met ? 'text-success' : 'text-textSecondary'}`}
        >
          {requirement.met ? '✓' : '○'} {requirement.text}
        </Text>
      ))}
    </View>
  );
}
