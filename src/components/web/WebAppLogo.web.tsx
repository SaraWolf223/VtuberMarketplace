import { useState, type SyntheticEvent } from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import {
  WEB_AUTH_LOGO_HEIGHT,
  WEB_CUSTOM_AUTH_MARK_SIZE,
  WEB_CUSTOM_AUTH_TEXT_MAX_WIDTH,
  WEB_CUSTOM_AUTH_TEXT_SIZE,
  WEB_CUSTOM_LOGO_WIDE_ASPECT_MIN,
  WEB_CUSTOM_MARK_ZOOM,
  WEB_CUSTOM_TOP_BAR_MARK_SIZE,
  WEB_CUSTOM_TOP_BAR_TEXT_MAX_WIDTH,
  WEB_CUSTOM_TOP_BAR_TEXT_SIZE,
  WEB_LOGO_LOCKUP_ASPECT,
  WEB_TOP_BAR_LOGO_HEIGHT,
} from '@/constants/web-app-logo';
import { useBrandLogoUrl, useWebLogoLockupUri } from '@/hooks/useBrandLogo';
import { useAppConfigStore } from '@/stores/app-config-store';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  onPress?: () => void;
  accessibilityLabel?: string;
  prominent?: boolean;
  height?: number;
};

/** Web — native img for crisp PNG scaling (no mark+text composite blur). */
export function WebAppLogo({
  onPress,
  accessibilityLabel,
  prominent = false,
  height,
}: Props): React.JSX.Element {
  const logoUri = useWebLogoLockupUri();
  const customLogoUrl = useBrandLogoUrl();
  const appDisplayName = useAppConfigStore((s) => s.config.appDisplayName);
  const colors = useThemeColors();
  const [customAspect, setCustomAspect] = useState<number | null>(null);
  const label = accessibilityLabel ?? appDisplayName;
  const hasCustomLogo = !!customLogoUrl;
  const customLogoLooksWide =
    hasCustomLogo && customAspect != null && customAspect >= WEB_CUSTOM_LOGO_WIDE_ASPECT_MIN;
  const shouldRenderCustomMark = hasCustomLogo && !customLogoLooksWide;
  const logoHeight = height ?? (prominent ? WEB_TOP_BAR_LOGO_HEIGHT : WEB_AUTH_LOGO_HEIGHT);
  const logoAspect = customLogoLooksWide && customAspect ? customAspect : WEB_LOGO_LOCKUP_ASPECT;
  const logoWidth = Math.round(logoHeight * logoAspect);
  const markSize = height ?? (prominent ? WEB_CUSTOM_TOP_BAR_MARK_SIZE : WEB_CUSTOM_AUTH_MARK_SIZE);
  const customTextSize = prominent ? WEB_CUSTOM_TOP_BAR_TEXT_SIZE : WEB_CUSTOM_AUTH_TEXT_SIZE;
  const customTextMaxWidth = prominent
    ? WEB_CUSTOM_TOP_BAR_TEXT_MAX_WIDTH
    : WEB_CUSTOM_AUTH_TEXT_MAX_WIDTH;

  const handleLogoLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setCustomAspect(img.naturalWidth / img.naturalHeight);
    }
  };

  const imgStyle = shouldRenderCustomMark
    ? {
        display: 'block',
        width: markSize,
        height: markSize,
        objectFit: 'contain' as const,
        transform: `scale(${WEB_CUSTOM_MARK_ZOOM})`,
        transformOrigin: 'center',
      }
    : {
        display: 'block',
        width: logoWidth,
        height: logoHeight,
        maxWidth: logoWidth,
        maxHeight: logoHeight,
        objectFit: 'contain' as const,
      };

  const img = (
    <img
      src={logoUri}
      alt=""
      width={shouldRenderCustomMark ? markSize : logoWidth}
      height={shouldRenderCustomMark ? markSize : logoHeight}
      onLoad={hasCustomLogo ? handleLogoLoad : undefined}
      style={imgStyle}
    />
  );

  const content = shouldRenderCustomMark ? (
    <View
      style={[styles.customRow, { height: markSize, maxHeight: markSize }]}
      testID="web-app-logo"
    >
      <View style={[styles.customMarkFrame, { width: markSize, height: markSize }]}>
        {img}
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
      {img}
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
  customText: {
    fontWeight: '700',
  },
});
