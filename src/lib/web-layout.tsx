import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { WebSubpageHeader } from '@/components/web/WebSubpageHeader';
import type { ColorPalette } from '@/theme/palettes';

type StackHeaderProps = {
  options: { title?: string };
  navigation: { canGoBack: () => boolean; goBack: () => void };
};

type WebStackNavigationOptions = {
  title?: string;
  headerShown?: boolean;
  headerStyle?: StyleProp<ViewStyle>;
  headerTintColor?: string;
  headerShadowVisible?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  header?: (props: StackHeaderProps) => React.JSX.Element;
  [key: string]: unknown;
};

function webStackHeader({ options, navigation }: StackHeaderProps): React.JSX.Element {
  const title = typeof options.title === 'string' ? options.title : '';
  return (
    <WebSubpageHeader
      title={title}
      showBack={navigation.canGoBack()}
      onBack={() => navigation.goBack()}
    />
  );
}

/** Merge native stack options with a compact web subpage header (below global top nav). */
export function mergeWebStackScreenOptions(
  base: WebStackNavigationOptions,
  colors?: Pick<ColorPalette, 'surface' | 'text'>
): WebStackNavigationOptions {
  if (Platform.OS !== 'web') return base;

  const baseHeaderStyle = StyleSheet.flatten(base.headerStyle);

  return {
    ...base,
    headerShown: true,
    header: webStackHeader,
    headerStyle: { backgroundColor: colors?.surface ?? baseHeaderStyle?.backgroundColor },
    headerTintColor: colors?.text ?? base.headerTintColor,
    headerShadowVisible: false,
  };
}
