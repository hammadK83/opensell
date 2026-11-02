import { Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export default function AppButton({ title, onPress, loading, disabled }: Props) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <TouchableOpacity
      onPress={() => {
        if (!isDisabled) onPress();
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      className={`bg-primary min-h-11 px-4 py-3 rounded-xl items-center justify-center ${isDisabled ? 'opacity-50' : ''}`}
    >
      {loading ? (
        <ActivityIndicator color={colors.primaryForeground} accessible={false} importantForAccessibility="no" />
      ) : (
        <Text className="text-primaryForeground font-semibold text-base text-center">{title}</Text>
      )}
    </TouchableOpacity>
  );
}
