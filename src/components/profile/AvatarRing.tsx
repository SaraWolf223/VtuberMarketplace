import { useEffect } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  avatarRingColor,
  resolveAvatarRingVariant,
  AVATAR_RING_WIDTH,
} from '@/lib/avatar-ring';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';

type Props = {
  size: number;
  isAdmin?: boolean;
  isPremium?: boolean;
  premiumUntil?: string | null;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

const GLOW_PAD = 5;

function AdminAvatarShine({ size }: { size: number }): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: 4200, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse, spin]);

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.45, 0.95]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.06]) }],
  }));

  const outer = size + GLOW_PAD * 2;

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          glowStyle,
          {
            width: outer,
            height: outer,
            borderRadius: outer / 2,
            borderColor: colors.avatarRingAdmin,
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.orbit, { width: size, height: size }, orbitStyle]}
      >
        <View style={[styles.spark, styles.sparkTop, { left: size / 2 - 4 }]} />
        <View style={[styles.spark, styles.sparkRight, { top: size / 2 - 3 }]} />
        <View style={[styles.spark, styles.sparkBottom, { left: size / 2 - 3 }]} />
      </Animated.View>
    </>
  );
}

/** Purple ring for Premium; bright gold ring with shine for admin. */
export function AvatarRing({
  size,
  isAdmin,
  isPremium,
  premiumUntil,
  style,
  children,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const variant = resolveAvatarRingVariant({ isAdmin, isPremium, premiumUntil });
  const ringColor = avatarRingColor(variant);
  const isAdminRing = variant === 'admin';

  if (!ringColor) {
    return <View style={[{ width: size, height: size }, style]}>{children}</View>;
  }

  const wrapSize = isAdminRing ? size + GLOW_PAD * 2 : size;

  return (
    <View
      style={[
        styles.wrap,
        { width: wrapSize, height: wrapSize },
        isAdminRing && styles.wrapAdmin,
        style,
      ]}
    >
      {isAdminRing ? <AdminAvatarShine size={size} /> : null}
      <View
        style={[
          styles.ring,
          isAdminRing && styles.ringAdmin,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: ringColor,
            borderWidth: isAdminRing ? AVATAR_RING_WIDTH + 1 : AVATAR_RING_WIDTH,
          },
        ]}
      >
        <View style={[styles.inner, { borderRadius: size / 2 }]}>{children}</View>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapAdmin: {
    overflow: 'visible',
  },
  glow: {
    position: 'absolute',
    borderWidth: 2,
    shadowColor: colors.avatarRingAdmin,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },
  orbit: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFFEF0',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  sparkTop: { top: -1 },
  sparkRight: { right: -1, width: 6, height: 6 },
  sparkBottom: { bottom: -1, width: 5, height: 5 },
  ring: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringAdmin: {
    shadowColor: colors.avatarRingAdmin,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 8,
    elevation: 6,
  },
  inner: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
}));
