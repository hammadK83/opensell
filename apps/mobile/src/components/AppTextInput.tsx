import React, { useState } from 'react';
import { View, TextInput, Text, Pressable, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props extends TextInputProps {
  error?: string;
}

export default function AppTextInput({ error, secureTextEntry, ...props }: Props) {
  const [isPasswordHidden, setIsPasswordHidden] = useState(secureTextEntry);

  return (
    <View className="w-full">
      <View className="relative justify-center">
        <TextInput
          {...props}
          className="border border-border bg-surface pl-4 pr-12 py-3 rounded-xl text-text w-full"
          placeholderTextColor="#6B7280"
          secureTextEntry={isPasswordHidden}
        />

        {secureTextEntry !== undefined && (
          <Pressable
            onPress={() => setIsPasswordHidden(!isPasswordHidden)}
            className="absolute right-4 p-1"
          >
            <Ionicons
              name={isPasswordHidden ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color="#6B7280"
            />
          </Pressable>
        )}
      </View>

      {error ? <Text className="text-error text-sm mt-1">{error}</Text> : null}
    </View>
  );
}
