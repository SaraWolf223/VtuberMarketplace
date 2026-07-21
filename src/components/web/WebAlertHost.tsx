import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AlertButton } from 'react-native';
import { subscribeWebAlerts, type WebAlertRequest } from '@/lib/cross-platform-alert';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';

const DEFAULT_BUTTONS: AlertButton[] = [{ text: 'OK' }];

export function WebAlertHost(): React.JSX.Element | null {
  const colors = useThemeColors();
  const styles = useStyles();
  const [queue, setQueue] = useState<WebAlertRequest[]>([]);
  const active = queue[0];

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    return subscribeWebAlerts((request) => {
      setQueue((current) => [...current, request]);
    });
  }, []);

  if (Platform.OS !== 'web' || !active) {
    return null;
  }

  const buttons = active.buttons?.length ? active.buttons : DEFAULT_BUTTONS;

  const closeWith = (button?: AlertButton) => {
    setQueue((current) => current.slice(1));
    button?.onPress?.();
  };

  const dismiss = () => {
    if (active.options?.cancelable === false) return;
    const cancelButton = buttons.find((button) => button.style === 'cancel');
    setQueue((current) => current.slice(1));
    cancelButton?.onPress?.();
    active.options?.onDismiss?.();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
        />
        <View
          style={styles.dialog}
          accessibilityRole="alert"
          accessibilityLabel={active.title}
        >
          <Text style={styles.title}>{active.title}</Text>
          {active.message ? <Text style={styles.message}>{active.message}</Text> : null}
          <View style={styles.buttonRow}>
            {buttons.map((button, index) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';
              return (
                <Pressable
                  key={`${active.id}-${button.text ?? 'OK'}-${index}`}
                  style={[
                    styles.button,
                    isCancel && styles.buttonSecondary,
                    isDestructive && styles.buttonDanger,
                  ]}
                  onPress={() => closeWith(button)}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel && styles.buttonSecondaryText,
                      isDestructive && { color: colors.onPrimary },
                    ]}
                  >
                    {button.text ?? 'OK'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 10, 15, 0.42)',
    padding: spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  message: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  button: {
    minHeight: 44,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  buttonDanger: {
    backgroundColor: colors.error,
  },
  buttonText: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.onPrimary,
    textAlign: 'center',
  },
  buttonSecondaryText: {
    color: colors.text,
  },
}));
