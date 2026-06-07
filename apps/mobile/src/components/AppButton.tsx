import { Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export default function AppButton({ title, onPress, loading, disabled }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`bg-primary px-4 py-3 rounded-xl items-center justify-center overflow-hidden ${disabled ? 'opacity-50' : ''}`}
    >
      {loading ? (
        <ActivityIndicator color={colors.primaryForeground} />
      ) : (
        <Text className="text-primaryForeground font-semibold text-base">{title}</Text>
      )}
    </TouchableOpacity>
  );
}
