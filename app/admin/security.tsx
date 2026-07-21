import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useProfile } from '@/hooks/useProfile';
import { TotpSecurityManager } from '@/components/security/TotpSecurityManager';
import { spacing } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

export default function AdminSecurityScreen(): React.JSX.Element {
  const styles = useStyles();
  useThemeColors();
  const { data: profile } = useProfile();

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.intro}>
        <Text style={styles.title}>Two-factor authentication</Text>
        <Text style={styles.body}>
          {profile?.role === 'manager' ? 'Manager' : 'Admin'} accounts are required to enroll an
          authenticator app before they can use the admin panel. This protects the panel even if a
          password or session token is ever compromised.
        </Text>
      </View>
      <TotpSecurityManager mandatory />
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  intro: { gap: spacing.xs },
  title: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.text },
  body: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 21 },
}));
