import React, { useEffect, useState } from 'react';
import { View, TextInput, Text, Pressable, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props extends TextInputProps {
  error?: string;
}

export default function AppTextInput({ error, secureTextEntry, ...props }: Props) {
  const isPasswordField = secureTextEntry === true;
  const [visibility, setVisibility] = useState({ isPasswordField, hidden: true });
  const isPasswordHidden = visibility.isPasswordField === isPasswordField
    ? visibility.hidden
    : true;

  useEffect(() => {
    if (visibility.isPasswordField !== isPasswordField) {
      setVisibility({ isPasswordField, hidden: true });
    }
  }, [isPasswordField, visibility.isPasswordField]);

  const accessibilityHint = error
    ? [props.accessibilityHint, `Error: ${error}`].filter(Boolean).join('. ')
    : props.accessibilityHint;

  return (
    <View className="w-full">
      <View className="relative justify-center">
        <TextInput
          {...props}
          className="border border-border bg-surface pl-4 pr-14 py-3 rounded-xl text-text w-full"
          placeholderTextColor="#6B7280"
          accessibilityLabel={props.accessibilityLabel ?? props.placeholder}
          accessibilityHint={accessibilityHint}
          secureTextEntry={isPasswordField ? isPasswordHidden : false}
        />

        {isPasswordField && (
          <Pressable
            onPress={() => setVisibility({ isPasswordField: true, hidden: !isPasswordHidden })}
            accessibilityRole="button"
            accessibilityLabel={isPasswordHidden ? 'Show password' : 'Hide password'}
            className="absolute right-2 h-11 w-11 items-center justify-center"
          >
            <Ionicons
              name={isPasswordHidden ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color="#6B7280"
              accessible={false}
              importantForAccessibility="no"
            />
          </Pressable>
        )}
      </View>

      {error ? (
        <Text className="text-error text-sm mt-1" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
