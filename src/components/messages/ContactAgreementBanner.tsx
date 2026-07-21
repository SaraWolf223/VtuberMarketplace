import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import type { ContactAgreementState } from '@/types/contact-agreement';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  agreement: ContactAgreementState | undefined;
  otherName: string;
  isSeller: boolean;
  listingActive: boolean;
  markingSold: boolean;
  proposing: boolean;
  accepting: boolean;
  onProposeDeal: () => void;
  onAccept: () => void;
  onMarkSold?: () => void;
  markSoldWarning?: string;
};

export function ContactAgreementBanner({
  agreement,
  otherName,
  isSeller,
  listingActive,
  markingSold,
  proposing,
  accepting,
  onProposeDeal,
  onAccept,
  onMarkSold,
  markSoldWarning,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  if (!agreement) {
    return <View style={styles.wrap} />;
  }

  if (agreement.contact_unlocked) {
    return (
      <View style={[styles.wrap, styles.unlocked]}>
        <Text style={styles.unlockedTitle}>Deal agreed</Text>
        <Text style={styles.unlockedSub}>
          You both agreed to make a deal. Call, text, and phone numbers are available below.
        </Text>
        {isSeller && listingActive && onMarkSold ? (
          <>
            {markSoldWarning ? (
              <Text style={styles.soldWarning}>{markSoldWarning}</Text>
            ) : null}
            <Pressable style={styles.soldBtn} onPress={onMarkSold} disabled={markingSold}>
              {markingSold ? (
                <ActivityIndicator color={colors.error} />
              ) : (
                <Text style={styles.soldBtnText}>Mark listing sold & end chats</Text>
              )}
            </Pressable>
          </>
        ) : null}
      </View>
    );
  }

  if (!agreement.has_agreement) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Make a deal first</Text>
        <Text style={styles.sub}>
          Both of you must accept a deal before calling, texting, or sharing phone numbers.
        </Text>
        <Pressable style={styles.proposeBtn} onPress={onProposeDeal} disabled={proposing}>
          {proposing ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.proposeBtnText}>Propose deal</Text>
          )}
        </Pressable>
      </View>
    );
  }

  if (agreement.my_accepted && !agreement.other_accepted) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Waiting for {otherName}</Text>
        <Text style={styles.sub}>
          You accepted the deal. They need to accept before contact is unlocked.
        </Text>
      </View>
    );
  }

  if (!agreement.my_accepted) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{otherName} proposed a deal</Text>
        <Text style={styles.sub}>Accept to unlock call, text, and phone numbers.</Text>
        <Pressable style={styles.acceptBtn} onPress={onAccept} disabled={accepting}>
          {accepting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.acceptBtnText}>Accept deal</Text>
          )}
        </Pressable>
      </View>
    );
  }

  return <View style={styles.wrap} />;
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  unlocked: {
    backgroundColor: colors.priceBackground,
    borderColor: colors.primary,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  sub: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  unlockedTitle: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  unlockedSub: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  proposeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  proposeBtnText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
  acceptBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  acceptBtnText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
  soldWarning: {
    fontSize: fontSize.caption,
    color: colors.error,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  soldBtn: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  soldBtnText: {
    color: colors.error,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.caption,
  },
}));
