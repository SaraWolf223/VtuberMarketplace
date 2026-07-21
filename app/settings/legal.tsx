import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { LegalDocumentLinks } from '@/components/legal/LegalDocumentLinks';
import { CURRENT_TERMS_VERSION, PLATFORM_TERMS_SUMMARY } from '@/constants/legal';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { BUILD_APP_IDENTITY } from '@/config/app-identity';

export default function LegalSettingsScreen(): React.JSX.Element {
  const styles = useStyles();
  return (
    <>
      <Stack.Screen options={{ title: 'Legal' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Policies & agreements</Text>
        <Text style={styles.body}>{PLATFORM_TERMS_SUMMARY}</Text>
        <Text style={styles.note}>
          Policies are finalized for MVP use. Recommend attorney review before major scaling. Same
          content is published at {BUILD_APP_IDENTITY.appDomain} when the site is deployed.
        </Text>
        <View style={styles.card}>
          <LegalDocumentLinks showHeading={false} />
        </View>
        <Text style={styles.version}>Current in-app legal version: {CURRENT_TERMS_VERSION}</Text>
      </ScrollView>
    </>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  title: { fontSize: fontSize.h1, fontWeight: fontWeight.bold, color: colors.text },
  body: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22 },
  note: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  version: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
}));
