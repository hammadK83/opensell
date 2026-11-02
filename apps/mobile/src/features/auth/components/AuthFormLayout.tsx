import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: ReactNode;
  contentClassName?: string;
};

export default function AuthFormLayout({ children, contentClassName }: Props) {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View
          className={`px-4 py-4 ${contentClassName ?? ''}`}
          style={[styles.body, { paddingLeft: Math.max(insets.left, 16), paddingRight: Math.max(insets.right, 16) }]}
        >
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  body: {
    flexGrow: 1,
  },
});
