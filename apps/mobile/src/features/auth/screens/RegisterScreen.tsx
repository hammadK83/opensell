import React from 'react';
import { View, Alert, Text, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppTextInput, AppButton } from '../../../components';
import { registerUserSchema } from '@opensell/shared';
import { AuthStackParamList } from '../navigation/AuthStack';
import { register } from '../api/auth.api';
import { getApiErrorMessage } from '../../../services/api/handleApiError';
import PasswordValidator from '../components/PasswordValidator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

type RegisterFormData = z.infer<typeof registerUserSchema>;

export default function RegisterScreen({ navigation }: Props) {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<RegisterFormData>({
    mode: 'onChange', // Changed to onChange to keep isValid dynamic
    resolver: zodResolver(registerUserSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  // Watch ONLY the password field for the real-time checklist UI
  const passwordValue = watch('password') ?? '';

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await register(data);
      Alert.alert(
        'Registration Successful',
        'Please check your email to verify your account. You may then proceed to log in to your account.',
        [
          {
            text: 'Back to Login',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (error: unknown) {
      const message = getApiErrorMessage(error);
      Alert.alert('Registration Error', message);
    }
  };

  return (
    <View className="flex-1 bg-background px-4 py-4">
      <Text className="text-3xl font-bold text-text">Create Account</Text>
      <Text className="text-textSecondary mt-2">Sign up to start using OpenSell</Text>

      <View className="mt-8 gap-4">
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppTextInput
              placeholder="Name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.name?.message}
            />
          )}
        />

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

        <PasswordValidator password={passwordValue} />

        <View className="mt-4">
          <AppButton
            title="Create Account"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={!isValid || isSubmitting}
          />
        </View>

        <View className="mt-4 flex-row flex-wrap items-center">
          <Text className="text-textSecondary text-medium">Already registered? </Text>
          <Pressable onPress={() => navigation.goBack()}>
            <Text className="text-primary text-medium">Login to your account.</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
