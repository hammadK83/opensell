import { useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { useAppSelector } from '../../../store/hooks';
import LogoutButton from '../../auth/components/LogoutButton';

export default function ProfileScreen() {
  const user = useAppSelector((state) => state.auth.user);
  const [failedImage, setFailedImage] = useState<string | null>(null);

  if (!user) return null;

  const initials = user.name.trim().split(/\s+/).slice(0, 2)
    .map((part) => Array.from(part)[0] ?? '').join('').toUpperCase() || '?';
  const imageUri = user.profileImage;

  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
      <View className="px-4 py-6 gap-6">
        <View className="items-center gap-3">
          {imageUri && failedImage !== imageUri ? (
            <Image source={{ uri: imageUri }} className="h-24 w-24 rounded-[48px]"
              resizeMode="cover" accessibilityLabel={`${user.name}'s profile photo`}
              onError={() => setFailedImage(imageUri)} />
          ) : (
            <View className="h-24 w-24 rounded-[48px] bg-primary items-center justify-center"
              accessible accessibilityLabel={`${user.name}'s profile avatar`}>
              <Text className="text-3xl font-bold text-primaryForeground">{initials}</Text>
            </View>
          )}
          <Text className="text-2xl font-bold text-text text-center" selectable>{user.name}</Text>
        </View>

        <LogoutButton />
      </View>
    </ScrollView>
  );
}
