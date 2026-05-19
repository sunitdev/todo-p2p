// @ts-nocheck — deps not installed yet. See apps/mobile/README.md.
import { View, Text } from 'react-native';

export default function Settings() {
  return (
    <View className="flex-1 bg-bg-l1 px-4 pt-6">
      <Text className="text-title font-bold text-label">Settings</Text>
      <Text className="mt-2 text-callout text-label-secondary">
        Device · Sync · Storage · About — coming in a later wave.
      </Text>
    </View>
  );
}
