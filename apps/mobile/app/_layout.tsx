// @ts-nocheck — deps (expo, expo-router, react-native, *gesture-handler) not
// installed yet. Pending user approval per CLAUDE.md install rule. Remove this
// pragma after `bun install` (see apps/mobile/README.md).
import '../global.css';

import { Stack } from 'expo-router';
// TODO: enable after `bun install`
// import { GestureHandlerRootView } from 'react-native-gesture-handler';
// import { SafeAreaProvider } from 'react-native-safe-area-context';
// import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  // TODO: wrap with <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider>…
  // and mount <StatusBar style="auto" /> after deps are installed.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
