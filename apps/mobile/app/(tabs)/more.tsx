// @ts-nocheck — deps not installed yet. See apps/mobile/README.md.
import { View, Text } from 'react-native';

export default function More() {
  return (
    <View className="flex-1 bg-bg-l2 px-4 pt-6">
      <Text className="text-title font-bold text-label">More</Text>
      <Text className="mt-2 text-callout text-label-secondary">
        Anytime · Someday · Logbook · Settings — surfaces land in a later wave.
      </Text>
    </View>
  );
}
