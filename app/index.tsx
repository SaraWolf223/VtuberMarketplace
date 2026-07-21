import { View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { Image } from 'expo-image';
import { useAuthContext } from '@/providers/AuthProvider';
import { useTermsAcceptance } from '@/hooks/useTermsAcceptance';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { useLogoMarkSource } from '@/hooks/useBrandLogo';
import { useAppConfigStore } from '@/stores/app-config-store';

export default function Index(): React.JSX.Element {
  const styles = useStyles();
  const { isLoading, isSignedIn } = useAuthContext();
  const { isLoading: termsLoading, needsAcceptance } = useTermsAcceptance();
  const logoSource = useLogoMarkSource();
  const appDisplayName = useAppConfigStore((s) => s.config.appDisplayName);

  if (isLoading || (isSignedIn && termsLoading)) {
    return (
      <View style={styles.loading}>
        <Image
          source={logoSource}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel={appDisplayName}
        />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (needsAcceptance) {
    return <Redirect href="/accept-terms" />;
  }

  return <Redirect href="/(tabs)" />;
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  logo: {
    width: 120,
    height: 120,
  },
}));
