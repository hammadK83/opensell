import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen, RegisterScreen, ResendVerificationScreen } from '../screens';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ResendVerification: { email?: string } | undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ResendVerification" component={ResendVerificationScreen} options={{ title: 'Resend verification email' }} />
    </Stack.Navigator>
  );
}
