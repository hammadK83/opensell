import React from 'react';
import { View, Text } from 'react-native';
import LogoutButton from '../../auth/components/LogoutButton';

export default function HomeScreen() {
  return (
    <View className="flex-1 justify-center items-center">
      <Text>Home Screen</Text>
      <LogoutButton />
    </View>
  );
}
