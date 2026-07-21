import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { spacing, radius } from '@/theme/tokens';
import { useSafeBottomPadding } from '@/hooks/useSafeBottomPadding';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  onDeleteChat: () => void;
  onBlockUser: () => void;
  onReport?: () => void;
  onMarkListingSold?: () => void;
};

export function ConversationActionsMenu({
  onDeleteChat,
  onBlockUser,
  onReport,
  onMarkListingSold,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const safeBottom = useSafeBottomPadding();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const runAction = (action: () => void) => {
    close();
    action();
  };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={12} style={styles.menuBtn}>
        <Text style={styles.menuLabel}>⋯</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.container}>
          <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close menu" />
          <View style={[styles.sheet, { paddingBottom: safeBottom }]}>
            <Text style={styles.title}>Chat options</Text>

            {onReport ? (
              <Pressable
                style={styles.option}
                onPress={() => runAction(onReport)}
              >
                <Text style={styles.optionText}>Report user</Text>
              </Pressable>
            ) : null}

            {onMarkListingSold ? (
              <Pressable
                style={styles.option}
                onPress={() => runAction(onMarkListingSold)}
              >
                <Text style={[styles.optionText, styles.destructive]}>Mark listing sold</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={styles.option}
              onPress={() => runAction(onBlockUser)}
            >
              <Text style={[styles.optionText, styles.destructive]}>Block user</Text>
            </Pressable>

            <Pressable
              style={styles.option}
              onPress={() => runAction(onDeleteChat)}
            >
              <Text style={[styles.optionText, styles.destructive]}>Delete chat</Text>
            </Pressable>

            <Pressable style={styles.cancel} onPress={close}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  menuBtn: { paddingHorizontal: spacing.sm, marginRight: spacing.xs },
  menuLabel: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    lineHeight: 24,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  option: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: {
    fontSize: fontSize.body,
    color: colors.text,
    fontWeight: fontWeight.regular,
  },
  destructive: {
    color: colors.error,
    fontWeight: fontWeight.semibold,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  cancelText: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
}));
