import { ScrollView, StyleSheet } from 'react-native';
import { TotpSecurityManager } from '@/components/security/TotpSecurityManager';
import { spacing } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';

export default function SettingsSecurityScreen(): React.JSX.Element {
  const styles = useStyles();
  useThemeColors();
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <TotpSecurityManager />
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
}));
