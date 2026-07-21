import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LegalDocumentLinks } from '@/components/legal/LegalDocumentLinks';
import { LEGAL_URLS } from '@/constants/legal-urls';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { useAppConfigStore } from '@/stores/app-config-store';
import { fontSize, fontWeight } from '@/theme/typography';

export default function SafetyScreen(): React.JSX.Element {
  const styles = useStyles();
  const router = useRouter();
  const appDisplayName = useAppConfigStore((state) => state.config.appDisplayName);

  return (
    <>
      <Stack.Screen options={{ title: 'Trust & safety' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Trust & safety on {appDisplayName}</Text>
        <Text style={styles.body}>
          {appDisplayName} is a marketplace for pre-made digital VTuber assets. Every listing is
          reviewed against our content rules, and every sale is backed by seller-authored
          licensing and a link-health strike system — here is how it works and how to report a
          problem.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Report a problem</Text>
          <Text style={styles.body}>
            On any listing, tap Report listing. On a seller profile, use Report user. Our team
            reviews reports within 24 hours.
          </Text>
          <Text style={styles.body}>
            Listings with many reports, or a download link that repeatedly fails health checks,
            may be paused automatically until a moderator reviews them.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Report a broken download link</Text>
          <Text style={styles.body}>
            If a seller&apos;s download link doesn&apos;t work after purchase, report it from your
            order. We follow up with the seller and, if the link isn&apos;t fixed within a
            reasonable grace period, it counts toward that seller&apos;s strikes. Three
            non-expired strikes in a rolling 12-month window result in an automatic account ban.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Content we don&apos;t allow</Text>
          <Text style={styles.body}>
            AI-generated assets and stolen/unauthorized art are banned. Explicit sexual content is
            banned outright. Suggestive, non-explicit content is allowed only when flagged as
            mature. See the Community Guidelines below for the full policy and enforcement ladder.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Copyright concerns</Text>
          <Text style={styles.body}>
            If you believe a listing infringes your copyright, file a notice under our DMCA /
            Copyright Policy below rather than a general report.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Block someone</Text>
          <Text style={styles.body}>
            Block a seller from a listing or their profile. You will not see their listings in
            your feed, and they cannot send you new messages through the app.
          </Text>
        </View>

        <Text style={styles.legalHeading}>Legal</Text>
        <View style={styles.card}>
          <LegalDocumentLinks showHeading={false} compact />
        </View>
        <Pressable
          style={styles.moreLegalBtn}
          onPress={() => void Linking.openURL(LEGAL_URLS.dmcaCopyrightPolicy)}
        >
          <Text style={styles.moreLegalText}>Open DMCA / Copyright Policy</Text>
        </Pressable>
        <Pressable style={styles.moreLegalBtn} onPress={() => router.push('/settings/legal')}>
          <Text style={styles.moreLegalText}>View all policies & legal version</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  title: { fontSize: fontSize.h1, fontWeight: fontWeight.bold, color: colors.text },
  body: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.text },
  legalHeading: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.md,
  },
  linkBtn: { paddingVertical: spacing.sm },
  linkText: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.body },
  moreLegalBtn: { paddingVertical: spacing.sm },
  moreLegalText: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.caption,
  },
}));
