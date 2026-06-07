import React from 'react';
import { View, Alert, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import AppTextInput from '../../../components/AppTextInput';
import AppButton from '../../../components/AppButton';
import { registerUserSchema } from '@opensell/shared';

type RegisterFormData = z.infer<typeof registerUserSchema>;

export default function RegisterScreen() {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    resolver: zodResolver(registerUserSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  const [nameValue, emailValue, passwordValue] = watch(['name', 'email', 'password']);
  const allFilled = Boolean(nameValue && emailValue && passwordValue);
  const schemaValid = registerUserSchema.safeParse({
    name: nameValue ?? '',
    email: emailValue ?? '',
    password: passwordValue ?? '',
  }).success;

  const pwd = passwordValue ?? '';
  const meetsLength = pwd.length >= 8;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

  const onSubmit = async (data: RegisterFormData) => {
    try {
      // replace with your API call
      console.log('register payload:', data);

      Alert.alert('Success', 'Account created successfully');
    } catch (err) {
      Alert.alert('Error', 'Something went wrong');
    }
  };

  return (
    <View className="flex-1 bg-background px-6 pt-24">
      <Text className="text-3xl font-bold text-text">Create Account</Text>

      <Text className="text-textSecondary mt-2">Sign up to start using OpenSell</Text>

      <View className="mt-8 gap-4">
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value } }) => (
            <AppTextInput
              placeholder="Full name"
              value={value}
              onChangeText={onChange}
              error={errors.name?.message}
            />
          )}
        />

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

        <View className="mt-2">
          <Text className={`text-sm ${meetsLength ? 'text-success' : 'text-textSecondary'}`}>
            {meetsLength ? '✓' : '○'} At least 8 characters
          </Text>
          <Text className={`text-sm ${hasUpper ? 'text-success' : 'text-textSecondary'}`}>
            {hasUpper ? '✓' : '○'} Contains an uppercase letter
          </Text>
          <Text className={`text-sm ${hasLower ? 'text-success' : 'text-textSecondary'}`}>
            {hasLower ? '✓' : '○'} Contains a lowercase letter
          </Text>
          <Text className={`text-sm ${hasNumber ? 'text-success' : 'text-textSecondary'}`}>
            {hasNumber ? '✓' : '○'} Contains a number
          </Text>
          <Text className={`text-sm ${hasSpecial ? 'text-success' : 'text-textSecondary'}`}>
            {hasSpecial ? '✓' : '○'} Contains a special character
          </Text>
        </View>

        <View className="mt-4">
          <AppButton
            title="Create Account"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={!allFilled || !schemaValid || isSubmitting}
          />
        </View>
      </View>
    </View>
  );
}
