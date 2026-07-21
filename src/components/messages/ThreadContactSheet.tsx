import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import {
  revealConversationPhones,
  agreementTypeLabel,
} from '@/features/messages/contact-agreement-service';
import type { ContactAgreementState } from '@/types/contact-agreement';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useSafeBottomPadding } from '@/hooks/useSafeBottomPadding';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { useAppConfigStore } from '@/stores/app-config-store';

type Props = {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  listingTitle: string;
  accessToken: string;
  agreement: ContactAgreementState | undefined;
  otherName: string;
};

/** Call/text + phone reveal — only after both parties accept the contact agreement. */
export function ThreadContactSheet({
  visible,
  onClose,
  conversationId,
  listingTitle,
  accessToken,
  agreement,
  otherName,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const safeBottom = useSafeBottomPadding();
  const [myPhone, setMyPhone] = useState<string | null>(null);
  const [otherPhone, setOtherPhone] = useState<string | null>(null);
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const appDisplayName = useAppConfigStore((state) => state.config.appDisplayName);

  const unlocked = agreement?.contact_unlocked ?? false;

  const smsBody = `Hi! About "${listingTitle}" on ${appDisplayName}.`;

  const openSms = async (number: string) => {
    const url = `sms:${number}?body=${encodeURIComponent(smsBody)}`;
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      onClose();
    } else {
      Alert.alert('SMS unavailable', 'No messaging app found on this device.');
    }
  };

  const callNumber = async (number: string) => {
    const url = `tel:${number}`;
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      onClose();
    }
  };

  const loadPhones = async () => {
    setLoadingPhone(true);
    try {
      const result = await revealConversationPhones(accessToken, conversationId);
      setMyPhone(result.my_phone);
      setOtherPhone(result.other_phone);
      setLoaded(true);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load phone numbers');
    } finally {
      setLoadingPhone(false);
    }
  };

  const handleOpen = () => {
    if (!unlocked) return;
    if (!loaded) {
      void loadPhones();
    }
  };

  const lockedMessage = () => {
    if (!agreement?.has_agreement) {
      return 'Propose contact in the chat. Both of you must accept before phone numbers are shared.';
    }
    if (agreement.my_accepted && !agreement.other_accepted) {
      return `Waiting for ${otherName} to accept.`;
    }
    if (!agreement.my_accepted) {
      const kind = agreement.agreement_type
        ? agreementTypeLabel(agreement.agreement_type)
        : 'connect';
      return `${otherName} proposed to ${kind}. Accept in the chat to unlock contact.`;
    }
    return 'Both parties must accept before contact is unlocked.';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      onDismiss={() => {
        setMyPhone(null);
        setOtherPhone(null);
        setLoaded(false);
      }}
      onShow={handleOpen}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: safeBottom }]}>
        <Text style={styles.title}>Contact outside the app</Text>

        {!unlocked ? (
          <>
            <Text style={styles.sub}>{lockedMessage()}</Text>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Close</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.sub}>
              You both agreed to share contact. Phone numbers are shown below.
            </Text>

            {loadingPhone ? (
              <ActivityIndicator color={colors.primary} />
            ) : loaded ? (
              <>
                <Text style={styles.phoneLabel}>{otherName}&apos;s phone</Text>
                {otherPhone ? (
                  <>
                    <Text style={styles.phone}>{otherPhone}</Text>
                    <View style={styles.row}>
                      <Pressable
                        style={styles.action}
                        onPress={() => openSms(otherPhone)}
                      >
                        <Text style={styles.actionText}>Text {otherName}</Text>
                      </Pressable>
                      <Pressable
                        style={styles.secondary}
                        onPress={() => callNumber(otherPhone)}
                      >
                        <Text style={styles.secondaryText}>Call</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Text style={styles.missing}>No phone on file for {otherName}.</Text>
                )}

                <Text style={styles.phoneLabel}>Your phone (shared with them)</Text>
                <Text style={styles.phoneMuted}>{myPhone ?? 'No phone on your profile'}</Text>
              </>
            ) : (
              <Pressable style={styles.action} onPress={loadPhones}>
                <Text style={styles.actionText}>Show phone numbers</Text>
              </Pressable>
            )}

            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Close</Text>
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
    gap: spacing.md,
  },
  title: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.text },
  sub: { fontSize: fontSize.caption, color: colors.textSecondary, lineHeight: 18 },
  row: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  actionText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  secondaryText: { color: colors.primary, fontWeight: fontWeight.semibold },
  phoneLabel: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  phone: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.text },
  phoneMuted: { fontSize: fontSize.body, color: colors.textSecondary },
  missing: { fontSize: fontSize.caption, color: colors.textMuted },
  cancel: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { color: colors.textSecondary },
}));
