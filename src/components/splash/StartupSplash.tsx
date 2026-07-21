import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useLogoMarkSource } from '@/hooks/useBrandLogo';
import { useAppConfigStore } from '@/stores/app-config-store';

const LOGO_SIZE = 160;

type Props = {
  backgroundColor: string;
  onFinish: () => void;
};

export function StartupSplash({ backgroundColor, onFinish }: Props): React.JSX.Element {
  const logoSource = useLogoMarkSource();
  const appDisplayName = useAppConfigStore((s) => s.config.appDisplayName);
  const overlayOpacity = useSharedValue(1);
  const logoScale = useSharedValue(0.88);
  const logoOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) });
    logoScale.value = withSpring(1, { damping: 16, stiffness: 120 });

    const finishTimer = setTimeout(() => {
      overlayOpacity.value = withTiming(
        0,
        { duration: 350, easing: Easing.out(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(onFinish)();
        }
      );
    }, 900);

    const safetyTimer = setTimeout(onFinish, 2500);

    return () => {
      clearTimeout(finishTimer);
      clearTimeout(safetyTimer);
    };
  }, [logoOpacity, logoScale, onFinish, overlayOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.root, { backgroundColor }, overlayStyle]}
    >
      <Animated.View style={logoStyle}>
        <Image
          source={logoSource}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel={appDisplayName}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});
