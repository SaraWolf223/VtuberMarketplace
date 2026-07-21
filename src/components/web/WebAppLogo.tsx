import { View, Pressable, StyleSheet, Platform, Text } from 'react-native';
import { Image } from 'expo-image';
import {
  WEB_AUTH_LOGO_HEIGHT,
  WEB_CUSTOM_AUTH_MARK_SIZE,
  WEB_CUSTOM_AUTH_TEXT_MAX_WIDTH,
  WEB_CUSTOM_AUTH_TEXT_SIZE,
  WEB_CUSTOM_MARK_ZOOM,
  WEB_CUSTOM_TOP_BAR_MARK_SIZE,
  WEB_CUSTOM_TOP_BAR_TEXT_MAX_WIDTH,
  WEB_CUSTOM_TOP_BAR_TEXT_SIZE,
  WEB_LOGO_LOCKUP_ASPECT,
  WEB_TOP_BAR_LOGO_HEIGHT,
} from '@/constants/web-app-logo';
import { useBrandLogoUrl, useWebLogoLockupSource } from '@/hooks/useBrandLogo';
import { useAppConfigStore } from '@/stores/app-config-store';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Larger lockup for desktop top bar. */
  prominent?: boolean;
  height?: number;
};

/** Local Marketplace logo — single PNG lockup for crisp web rendering. */
export function WebAppLogo({
  onPress,
  accessibilityLabel,
  prominent = false,
  height,
}: Props): React.JSX.Element {
  const logoSource = useWebLogoLockupSource();
  const customLogoUrl = useBrandLogoUrl();
  const appDisplayName = useAppConfigStore((s) => s.config.appDisplayName);
  const colors = useThemeColors();
  const label = accessibilityLabel ?? appDisplayName;
  const logoHeight = height ?? (prominent ? WEB_TOP_BAR_LOGO_HEIGHT : WEB_AUTH_LOGO_HEIGHT);
  const logoWidth = Math.round(logoHeight * WEB_LOGO_LOCKUP_ASPECT);
  const markSize = height ?? (prominent ? WEB_CUSTOM_TOP_BAR_MARK_SIZE : WEB_CUSTOM_AUTH_MARK_SIZE);
  const customTextSize = prominent ? WEB_CUSTOM_TOP_BAR_TEXT_SIZE : WEB_CUSTOM_AUTH_TEXT_SIZE;
  const customTextMaxWidth = prominent
    ? WEB_CUSTOM_TOP_BAR_TEXT_MAX_WIDTH
    : WEB_CUSTOM_AUTH_TEXT_MAX_WIDTH;

  const content = customLogoUrl ? (
    <View
      style={[styles.customRow, { height: markSize, maxHeight: markSize }]}
      testID="web-app-logo"
    >
      <View style={[styles.customMarkFrame, { width: markSize, height: markSize }]}>
        <Image
          source={logoSource}
          style={[
            styles.customMarkImage,
            { transform: [{ scale: WEB_CUSTOM_MARK_ZOOM }] },
          ]}
          contentFit="contain"
          accessibilityLabel=""
        />
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.customText,
          { color: colors.text, fontSize: customTextSize, maxWidth: customTextMaxWidth },
        ]}
      >
        {appDisplayName}
      </Text>
    </View>
  ) : (
    <View
      style={[styles.row, { height: logoHeight, maxHeight: logoHeight }]}
      testID="web-app-logo"
    >
      <Image
        source={logoSource}
        style={{ width: logoWidth, height: logoHeight, maxHeight: logoHeight }}
        contentFit="contain"
        accessibilityLabel=""
        {...(Platform.OS === 'web'
          ? ({ recyclingKey: 'web-logo-lockup' } as const)
          : {})}
      />
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="link"
        accessibilityLabel={label}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'visible',
  },
  customMarkFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  customMarkImage: {
    width: '100%',
    height: '100%',
  },
  customText: {
    fontWeight: '700',
  },
});
