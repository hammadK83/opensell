import React from 'react';
import { View, Alert, Text, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppTextInput, AppButton } from '../../../components';
import { loginBodySchema } from '@opensell/shared';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/AuthNavigator';
import { login } from '../api/auth.api';
import { getApiErrorMessage } from '../../../services/api/handleApiError';

type LoginFormData = z.infer<typeof loginBodySchema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoginFormData>({
    mode: 'onChange', // Changed to onChange so isValid updates dynamically
    resolver: zodResolver(loginBodySchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      const res = await login(data);
      console.log('login response:', res);
      Alert.alert('Success', 'Logged in successfully');
      // TODO: persist tokens and navigate to app
    } catch (error: unknown) {
      const message = getApiErrorMessage(error);
      Alert.alert('Error', message);
    }
  };

  return (
    <View className="flex-1 bg-background px-4 py-4">
      <Text className="text-3xl font-bold text-text">Welcome Back</Text>
      <Text className="text-textSecondary mt-2">Sign in to your account</Text>

      <View className="mt-8 gap-4">
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppTextInput
              placeholder="Email"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppTextInput
              placeholder="Password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              secureTextEntry
              error={errors.password?.message}
            />
          )}
        />

        <View className="mt-4">
          <AppButton
            title="Sign In"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={!isValid || isSubmitting}
          />
        </View>

        <View className="mt-4 flex-row flex-wrap items-center">
          <Text className="text-textSecondary text-medium">Not registered? </Text>
          <Pressable onPress={() => navigation.navigate('Register')}>
            <Text className="text-primary text-medium">Create an account.</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
