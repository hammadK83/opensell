import React from 'react';
import { View } from 'react-native';
import { useSelector } from 'react-redux';
import { LoginScreen, RegisterScreen } from '../screens';
import { AuthRouteNames } from './authNavigationSlice';

export function AuthNavigator() {
  const currentScreen = useSelector(
    (state: { authNavigation: { currentScreen: AuthRouteNames } }) =>
      state.authNavigation.currentScreen,
  );

  return (
    <View className="flex-1">
      {currentScreen === 'Login' ? <LoginScreen /> : <RegisterScreen />}
    </View>
  );
}
