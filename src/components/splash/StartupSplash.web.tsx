import { useEffect } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useLogoMarkSource } from '@/hooks/useBrandLogo';
import { useAppConfigStore } from '@/stores/app-config-store';

const LOGO_SIZE = 160;
const SPLASH_MS = 400;

type Props = {
  backgroundColor: string;
  onFinish: () => void;
};

/** Web splash — no Reanimated (worklet callbacks often never fire in the browser). */
export function StartupSplash({ backgroundColor, onFinish }: Props): React.JSX.Element {
  const logoSource = useLogoMarkSource();
  const appDisplayName = useAppConfigStore((s) => s.config.appDisplayName);

  useEffect(() => {
    const timer = setTimeout(onFinish, SPLASH_MS);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View pointerEvents="none" style={[styles.root, { backgroundColor }]}>
      <Image
        source={logoSource}
        style={styles.logo}
        contentFit="contain"
        accessibilityLabel={appDisplayName}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});
