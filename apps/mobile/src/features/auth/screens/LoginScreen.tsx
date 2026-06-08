import React from 'react';
import { View, Alert, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import AppTextInput from '../../../components/AppTextInput';
import AppButton from '../../../components/AppButton';
import { loginBodySchema } from '@opensell/shared';

type LoginFormData = z.infer<typeof loginBodySchema>;

export default function LoginScreen() {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    resolver: zodResolver(loginBodySchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const [emailValue, passwordValue] = watch(['email', 'password']);
  const allFilled = Boolean(emailValue?.trim() && passwordValue?.trim());

  const schemaValid = loginBodySchema.safeParse({
    email: emailValue ?? '',
    password: passwordValue ?? '',
  }).success;

  const onSubmit = async (data: LoginFormData) => {
    try {
      console.log('login payload:', data);
      Alert.alert('Success', 'Logged in successfully');
    } catch (err) {
      Alert.alert('Error', 'Unable to sign in. Please try again later.');
    }
  };

  return (
    <View className="flex-1 bg-background px-6 pt-24">
      <Text className="text-3xl font-bold text-text">Welcome Back</Text>
      <Text className="text-textSecondary mt-2">Sign in to your account</Text>

      <View className="mt-8 gap-4">
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <AppTextInput
              placeholder="Email"
              value={value}
              onChangeText={onChange}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <AppTextInput
              placeholder="Password"
              value={value}
              onChangeText={onChange}
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
            disabled={!allFilled || !schemaValid || isSubmitting}
          />
        </View>
      </View>
    </View>
  );
}
