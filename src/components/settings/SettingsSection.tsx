import { View, Text, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  title: string;
  footer?: string;
  children: ReactNode;
};

export function SettingsSection({ title, footer, children }: Props): React.JSX.Element {
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.card}>{children}</View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  footer: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginLeft: spacing.xs,
    marginTop: spacing.xs,
  },
}));
