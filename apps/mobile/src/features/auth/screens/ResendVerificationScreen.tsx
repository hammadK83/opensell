import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton, AppTextInput } from '../../../components';
import { AuthStackParamList } from '../navigation/AuthStack';
import { resendVerification } from '../api/auth.api';
import { getApiErrorMessage } from '../../../services/api/handleApiError';
import { resendVerificationBodySchema } from '@opensell/shared';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResendVerification'>;

export default function ResendVerificationScreen({ route }: Props) {
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!resendVerificationBodySchema.safeParse({ email }).success) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      const message = await resendVerification(email);
      Alert.alert('Request received', message);
    } catch (error) {
      Alert.alert('Could not request email', getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-background px-4 py-4 gap-4">
      <Text className="text-3xl font-bold text-text">Resend verification email</Text>
      <Text className="text-textSecondary">Enter the email address you used to create your account.</Text>
      <AppTextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <AppButton title="Request verification email" onPress={submit} loading={busy} disabled={busy || !email.trim()} />
    </View>
  );
}
