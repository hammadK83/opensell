import { ScrollView, View, Text } from 'react-native';

export default function BrowseScreen() {
  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
      <View className="px-4 py-6">
        <Text className="text-3xl font-bold text-text">Welcome to OpenSell</Text>
      </View>
    </ScrollView>
  );
}
