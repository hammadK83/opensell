import { Text, TextInput, TextInputProps, View } from 'react-native';

type Props = TextInputProps & {
  error?: string;
};

export default function AppTextInput({ error, ...props }: Props) {
  return (
    <View>
      <TextInput
        {...props}
        className={`border border-border bg-surface px-4 py-3 rounded-xl text-text`}
        placeholderTextColor="#6B7280"
      />

      {error ? <Text className="text-error text-sm mt-1">{error}</Text> : null}
    </View>
  );
}
