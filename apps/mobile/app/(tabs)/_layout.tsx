// @ts-nocheck — deps not installed yet. See apps/mobile/README.md.
import { Tabs } from 'expo-router';
// TODO: enable after `bun install` — lucide icons for mobile
// import { CheckCircle2, Inbox, CalendarDays, MoreHorizontal } from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // TODO: token-tinted bar — wire bg-l1 / label colors after NativeWind boot.
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          // tabBarIcon: ({ color, size }) => <CheckCircle2 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          // tabBarIcon: ({ color, size }) => <Inbox color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="upcoming"
        options={{
          title: 'Upcoming',
          // tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          // tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
