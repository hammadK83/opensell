import { ScrollView, Text, View } from 'react-native';

export default function ChatListScreen() {
  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
      <View className="px-4 py-6">
        <View className="rounded-card border border-border bg-surface p-6 gap-3">
          <Text className="text-2xl font-bold text-text">Chats coming soon</Text>
        </View>
      </View>
    </ScrollView>
  );
}
