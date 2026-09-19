import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import AppStack from './AppStack';
import AuthStack from '../features/auth/navigation/AuthStack';
import { AppButton } from '../components';
import { bootstrapAuth } from '../features/auth/auth.bootstrap';

import { useAppDispatch, useAppSelector } from '../store/hooks';

export default function RootNavigator() {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state) => state.auth);

  useEffect(() => {
    void dispatch(bootstrapAuth());
  }, [dispatch]);

  if (auth.status === 'initializing') {
    return (
      <View className="flex-1 items-center justify-center bg-background" accessibilityRole="progressbar">
        <ActivityIndicator size="large" accessibilityLabel="Restoring your session" />
        <Text className="mt-4 text-text">Restoring your session...</Text>
      </View>
    );
  }

  if (auth.status === 'startupError') {
    return (
      <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
        <View className="px-4 py-8 gap-4">
          <Text className="text-xl font-bold text-text">Unable to restore your session</Text>
          <Text className="text-textSecondary" accessibilityRole="alert">{auth.startupError}</Text>
          <AppButton title="Try again" onPress={() => { void dispatch(bootstrapAuth()); }} />
        </View>
      </ScrollView>
    );
  }

  return auth.status === 'authenticated' ? <AppStack /> : <AuthStack />;
}
