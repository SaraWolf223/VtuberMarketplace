import { Stack } from 'expo-router';
import { useThemeColors } from '@/hooks/useThemeColors';
import { mergeWebStackScreenOptions } from '@/lib/web-layout';

export default function MessagesLayout(): React.JSX.Element {
  const colors = useThemeColors();

  return (
    <Stack
      screenOptions={mergeWebStackScreenOptions(
        {
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        },
        colors
      )}
    >
      <Stack.Screen name="index" options={{ title: 'Messages' }} />
      <Stack.Screen name="[id]" options={{ title: 'Conversation' }} />
    </Stack>
  );
}
